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
