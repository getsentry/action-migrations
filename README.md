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

### Usage as generic "github commenter bot"

This action can also be used to post arbitrary comments based off of the most
recent build for a PR.

Take a look at how [snuba](https://github.com/getsentry/snuba/blob/master/.github/workflows/ddl-changes.yml) uses this action. Example:

```
      - name: Generate some linting result
        uses: getsentry/action-migrations@v1.0.8
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          # need to set this to a nonempty string, it will be passed to the
          # script as cmdline arg
          migration: "bogus value"
          cmd: python scripts/check-for-dangerous-changes.py
          # Replace the default "This PR has a migration" intro.
          commentHeader: "We have found some dangerous change that is not related to SQL"
```
