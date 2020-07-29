import fs from 'fs';

import * as core from '@actions/core';
import * as github from '@actions/github';
import {exec} from '@actions/exec';

import {getMigrationName} from './util/getMigrationName';

const commentIntro = 'This PR has a migration; here is the generated SQL';
const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
const ev = JSON.parse(
  fs.readFileSync(process.env.GITHUB_EVENT_PATH || '', 'utf8')
);
const prNum = ev.pull_request.number;
const token = core.getInput('githubToken');
const octokit = github.getOctokit(token);

async function findBotComment() {
  // Look for existing comment
  const {data: comments} = await octokit.issues.listComments({
    owner,
    repo,
    issue_number: prNum,
  });

  return comments.find(
    comment =>
      comment.user.login === 'github-actions[bot]' &&
      comment.body.includes(commentIntro)
  );
}

async function createPlaceholderComment() {
  // See if comment already exists
  const existingComment = await findBotComment();

  if (existingComment) {
    return;
  }

  // Otherwise, create placeholder comment
  octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNum,
    body: `${commentIntro}

\`\`\`
Please wait while I generate the SQL ...
\`\`\`
`.trim(),
  });
}

async function run(): Promise<void> {
  try {
    const runInput: string = core.getInput('run');

    if (runInput === 'placeholder') {
      core.debug('Creating placeholder comment...');
      await createPlaceholderComment();
      core.debug('Finished creating placeholder comment...');
      return;
    }

    const migrationInput: string = core.getInput('migration');

    if (!migrationInput) {
      core.debug('No input files');
      return;
    }

    // Transform migration input into usable name (e.g. either number or filename w/o extension)
    const migrationName = getMigrationName(migrationInput);
    core.debug(`Generating SQL for migration: ${migrationName} ...`);

    let output = '';
    let error = '';

    await exec('sentry', ['django', 'sqlmigrate', 'sentry', migrationName], {
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
        stderr: (data: Buffer) => {
          error += data.toString();
        },
      },
    });

    if (error) {
      if (error.includes('CryptographyDeprecationWarning')) {
        core.warning(error);
      } else {
        core.setFailed(error);
      }
    } else if (output) {
      core.debug(output);

      const body = `${commentIntro}

\`\`\`sql
${output.trim()}
\`\`\`

`.trim();

      // Update existing comment
      const previousComment = await findBotComment();
      if (previousComment) {
        octokit.issues.updateComment({
          owner,
          repo,
          comment_id: previousComment.id,
          body,
        });
        return;
      }

      // This shouldn't happen, but just in case it can't find the placeholder comment,
      // create a new one (e.g. if it got deleted)
      octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNum,
        body,
      });
    } else {
      core.debug('Empty output from migration');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
