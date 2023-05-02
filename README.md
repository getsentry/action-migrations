## Code in Main

Install the dependencies
```bash
$ yarn
```

Build the typescript and package it for distribution
```bash
$ yarn build
```

Run the tests :heavy_check_mark:  
```bash
$ yarn test
...
```

## Publish to a distribution branch

Actions are run from GitHub repos so we will checkin the packed dist folder. 

Then run [ncc](https://github.com/zeit/ncc) and push the results:
```bash
$ yarn build
$ git add dist
$ git commit -a -m "prod dependencies"
$ git push origin main
```

Your action is now published! :rocket:

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)

## Usage:

In your workflow file

```
  - name: Generate SQL for migration
    uses: getsentry/action-migrations@v1.0.7
    env:
      SENTRY_LOG_LEVEL: ERROR
      PGPASSWORD: postgres
    with:
      githubToken: ${{ secrets.GITHUB_TOKEN }}
      migration: "./path/to/migration"
```

See [action.yml](action.yml) for more arguments.

## Drafting a new release

Anybody from engineering can release. Just go to [GitHub's create release
page](https://github.com/getsentry/action-migrations/releases) and do it.
Create a new tag vX.Y.Z, the rest doesn't really matter.
