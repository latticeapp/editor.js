# Branches, versions and releases — complete guideline

## Branches

The project has two main branches: `master` and `next`.

Branch `master` contains the latest stable version of the editor.
The latest version published to NPM available by default or by the tag `latest`.

Branch `next` used for development the next (release candidate) version of the editor.
It may contain bug fixes, improvements or features. This version is available in NPM by `next` tag.

## Versions

We use [semantic versioning](https://semver.org) as a main guide for naming updates.

`<major>.<minor>.<patch>`

You need to bump the part of version according the changes:

- `patch` — for bug fixes, docs updates, code style fixes and other changes which do not affect the result project bundle
- `minor` — for new features with no backward compatibility problems.
- `major` — for breaking changes without backward compatibility with the api of the previous version of the project.

Pre-release versions may contain additional `-rc.*` suffix.

## Release publishing

Drafts for new releases are created automatically via [create-a-release-draft.yml](.github/workflows/create-a-release-draft.yml)
workflow when pull request to `next` branch was merged with an updated version in the package.json file.

There is a [workflow](.github/workflows/publish-package-to-npm.yml) that fired on a new release publishing on GitHub.

Use target version changelog as a description.

![](https://capella.pics/57267bab-f2f0-411b-a9d1-69abee6abab5.jpg)

Then you can publish the release and wait for package publishing via action.

This package version will be published to NPM with default `latest` tag.

### Release candidate publishing

If you want to publish release candidate version, use suffix `-rc.*` for package
version in package.json file and in tag on releases page. Workflow will detect it and mark a release as "pre-release".

![](https://capella.pics/796de9eb-bbe0-485c-bc8f-9a4cb76641b7.jpg)

This package version will be published to NPM with `next` tag.

Stable version: `2.19.0`
Release candidate: `2.19.1-rc.0`, `2.19.1-rc.1`, ...
Next version: `2.19.1`

## Example pipeline

Let's imagine that package version is `2.19.0` and you want to add some bug fixes and publish an update as `2.19.1`.

1. Merge a single update or a few pulls with fixes to the default branch `next`
and bump the version up to `2.19.1-rc.0` in the package.json.
For the rest rc updates you should bump version number in suffix (to `2.19.1-rc.1` etc).
2. Workflow [create-a-release-draft.yml](.github/workflows/create-a-release-draft.yml)
will automatically create a draft release on GitHub.
3. Check this new draft release on the releases page. Check tag `v2.19.1-rc.0` and notice "This is pre-release" checkbox
if it should be for a release candidate versions. Then publish that release.
4. [Workflow](.github/workflows/publish-package-to-npm.yml) will automatically push the package to NPM with tag `next`.
5. When you ready to publish a release, remove suffix from version name in package.json (`2.19.1-rc.0` -> `v2.19.1`)
and push changes. Follow steps 2-4 with workflows and publish a new version as `latest` update.
6. Merge branch `next` to `master` and save sources for history.


