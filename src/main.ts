import fs from 'fs';

import * as core from '@actions/core';
import * as github from '@actions/github';
import {exec} from '@actions/exec';

async function run(): Promise<void> {
  try {
    const migration: string = core.getInput('migration');
    core.debug(`Generating SQL for migration: ${migration} ...`);

    let output = '';
    let error = '';
    await exec('sentry', ['django', 'sqlmigrate', 'sentry', migration], {
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

      octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNum,
        body: `This PR has a migration; here is the generated SQL

\`\`\`
${output}
\`\`\`

`,
      });
    } else {
      core.debug('Empty output from migration');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
