import fs from 'fs';

import * as core from '@actions/core';
import * as github from '@actions/github';
import {exec} from '@actions/exec';

import {
  CommentClient,
  commentIntro,
  createPlaceholder,
  marker,
  syncComment,
} from './util/comments';
import {getMigrationNames} from './util/getMigrationName';

const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
const ev = JSON.parse(
  fs.readFileSync(process.env.GITHUB_EVENT_PATH || '', 'utf8')
);
const prNum = ev.pull_request.number;
const token = core.getInput('githubToken');
const octokit = github.getOctokit(token);

const client: CommentClient = {
  async list() {
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: prNum,
      per_page: 100,
    });
    return comments.map(comment => ({
      id: comment.id,
      body: comment.body ?? '',
      isBot: comment.user?.login === 'github-actions[bot]',
    }));
  },
  async create(body) {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNum,
      body,
    });
  },
  async update(id, body) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: id,
      body,
    });
  },
  async remove(id) {
    await octokit.rest.issues.deleteComment({owner, repo, comment_id: id});
  },
};

async function run(): Promise<void> {
  try {
    const runInput: string = core.getInput('run');
    const command: string = core.getInput('cmd');
    const name: string = core.getInput('name');
    const appLabel: string = core.getInput('app_label');
    const migrationInput: string = core.getInput('migration');
    const useRawBody = core.getInput('useRawBody') == 'true';

    const intro = commentIntro(migrationInput, name);

    if (runInput === 'placeholder') {
      core.debug('Creating placeholder comment...');
      await createPlaceholder(
        client,
        name,
        `${marker(name)}\n${intro}\n\n\`\`\`\nPlease wait while I generate the SQL ...\n\`\`\``
      );
      core.debug('Finished creating placeholder comment...');
      return;
    }

    if (!migrationInput) {
      core.debug('No input files');
      return;
    }

    let body = `${marker(name)}\n`;
    if (useRawBody) {
      body += `<!-- ${intro} -->\n`;
    } else {
      body += `${intro}\n`;
    }

    // Transform migration input into usable name (e.g. either number or filename w/o extension)
    for (const [djangoApp, migrationName] of getMigrationNames(
      migrationInput,
      appLabel
    )) {
      core.debug(
        `Generating SQL for migration: ${djangoApp} ${migrationName} ...`
      );

      let output = '';
      let error = '';

      const exitCode = await exec(command, [djangoApp, migrationName], {
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
        if (exitCode > 0) {
          core.setFailed(error);
        } else {
          core.warning(error);
        }
      }

      if (output) {
        core.debug(output);

        if (useRawBody) {
          body += `\
<!-- for ${migrationName} in ${djangoApp} -->
${output}
`;
        } else {
          body += `\

**for \`${migrationName}\` in \`${djangoApp}\`**

~~~sql
${output.trim()}
~~~
`;
        }
      } else {
        core.debug(`Empty output from migration ${migrationName} ${djangoApp}`);
      }
    }

    body = body.trim();

    await syncComment(client, name, body);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();
