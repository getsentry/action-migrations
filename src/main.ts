import fs from 'fs';

import * as core from '@actions/core';
import * as github from '@actions/github';
import {exec} from '@actions/exec';

const commentIntro = 'This PR has a migration; here is the generated SQL';

async function run(): Promise<void> {
  try {
    const migration: string = core.getInput('migration');
    if (!migration) {
      return;
    }

    // Transform migration into usable name (e.g. either number or filename w/o extension)
    const migrationName = migration
      .trim()
      .split('/')
      .slice(-1)[0]
      .replace('.py', '');

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
      core.setFailed(error);
    } else if (output) {
      core.debug(output);

      const token = core.getInput('githubToken');
      const octokit = github.getOctokit(token);
      const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
      const ev = JSON.parse(
        fs.readFileSync(process.env.GITHUB_EVENT_PATH || '', 'utf8')
      );
      const prNum = ev.pull_request.number;
      const body = `${commentIntro}

\`\`\`
${output.trim()}
\`\`\`

`.trim();

      // Look for existing comment
      const {data: comments} = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: prNum,
      });

      if (comments.length) {
        const previousComment = comments.find(comment => {
          core.debug(`${comment.user.login}, ${comment.user.id}`);
          return comment.body.includes(commentIntro);
        });

        if (previousComment) {
          // Update existing comment

          octokit.issues.updateComment({
            owner,
            repo,
            comment_id: previousComment.id,
            body,
          });
          return;
        }
      }

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
