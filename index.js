// TODO: Type Script
const {isNil} = require('lodash');
const parseJson = require('parse-json')
const SemanticReleaseError = require('@semantic-release/error');
const {prepare: execPrepare, publish: execPublish} = require('@semantic-release/exec')

async function getComposerPackageName() {
  parseJson(null, 'composer.info')['name']
}

async function getArtifactoryOrgPathModule(packageName) {
  const nameItems = packageName.split('/', 1);
  return { orgPath: nameItems[0], module: nameItems[1] };
}

async function verifyConditions(pluginConfig, context) {
  const composerName = getComposerPackageName();
  if (isNil(composerName)) {
    throw new SemanticReleaseError('Composer package name is not detected', 'EVERIFYCONDITIONS');
  }
  context.composer = {
    name: composerName,
    time: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''),
  }

  if (isNil(pluginConfig.repo)) {
    throw new SemanticReleaseError('repo is required', 'EVERIFYCONDITIONS');
  }
  const artifactory = {
    repo = pluginConfig.repo,
  }
  try {
    const {orgPath, module} = getArtifactoryOrgPathModule(composerName)
    artifactory.orgPath = orgPath;
    artifactory.module = module;
  } catch (error) {
    throw new SemanticReleaseError('Error detecting Artifactory orgPath or module', 'EVERIFYCONDITIONS');
  }
  context.artifactory = artifactory;
}

async function prepare(pluginConfig, context) {
  [
    'rm --recursive --force --verbose build',
    'composer archive --no-interaction --file=${ module }-${ nextRelease.version }',
    'gpg --armor --detach-sign build/*',
  ].forEach(prepareCmd =>
    execPrepare({
      prepareCmd: prepareCmd,
      execCwd: pluginConfig.execCwd,
    }, context)
  )
}
  
async function publish(pluginConfig, context) {
  const threads = process.env.ARTIFACTORY_THREADS
  if (!isNil(threads)) {
    context.threads = threads
  }
  return execPublish({
    // TODO: Assume standard Composer layout
    // [orgPath]/[module]/[module]-[baseRev](-[fileItegRev]).[ext]
    publishCmd: 'jfrog rt upload --fail-no-op ${ threads ? \'--threads=\' + threads : \'\'} --props "composer.version=${ nextRelease.version };composer.time=${ time }" build/* ${ repo }/${ orgPath }/${ module }/',
    execCwd: pluginConfig.execCwd,
  }, context)
}

module.exports = {
  verifyConditions,
  prepare,
  publish,
};
