import * as core from '@actions/core';
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

    core.debug(output);

    if (error) {
      core.setFailed(error);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
