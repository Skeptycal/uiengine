const { renderToString } = require('react-dom/server')
const { extractProperties } = require('./props')
const { extractDependentFiles, extractDependencyFiles } = require('./deps')
const {
  FileUtil: { invalidateRequireCache },
  StringUtil: { upcaseFirstChar }
} = require('@uiengine/util')

// hook functions which can be overwritten by custom adapters.
function wrapElementBeforeRender (Element, filePath, data) {
  return Element
}

function wrapHtmlAfterRender (html, filePath, data) {
  return html
}

async function setup (options) {
  const babelRegisterModule = options.babelRegisterModule || '@babel/register'
  const { babel } = options

  if (babel) {
    require(babelRegisterModule)(babel)
  } else {
    require(babelRegisterModule)
  }
}

async function registerComponentFile (options, filePath) {
  invalidateRequireCache(filePath)

  const [properties, dependentFiles, dependencyFiles] = await Promise.all([
    extractProperties(filePath),
    extractDependentFiles(options, filePath),
    extractDependencyFiles(options, filePath)
  ])

  const info = {}
  if (Object.keys(properties).length > 0) info.properties = properties
  if (Object.keys(dependentFiles).length > 0) info.dependentFiles = dependentFiles
  if (Object.keys(dependencyFiles).length > 0) info.dependencyFiles = dependencyFiles

  return info
}

async function render (options, filePath, data = {}) {
  invalidateRequireCache(filePath)

  let Element = require(filePath)
  if (Element.default) Element = Element.default
  Element = module.exports.wrapElementBeforeRender(Element, filePath, data)
  const vdom = Element(data)
  const html = renderToString(vdom)
  const rendered = module.exports.wrapHtmlAfterRender(html, filePath, data)

  return rendered
}

function filesForComponent (options, componentName) {
  const name = upcaseFirstChar(componentName)

  return [
    {
      basename: `${name}.jsx`,
      data: `import React from 'react'

const ${name} = props => {
  return (
    <div className='${componentName}'>
      {props.children}
    </div>
  )
}

export default ${name}
`
    }
  ]
}

function filesForVariant (options, componentName, variantName) {
  const cName = upcaseFirstChar(componentName)
  const vName = upcaseFirstChar(variantName)

  return [
    {
      basename: `${vName}.jsx`,
      data: `import React from 'react'
import ${cName} from '../${cName}.jsx'

export default props => (
  <${cName} {...props} />
)
`
    }
  ]
}

module.exports = {
  setup,
  render,
  registerComponentFile,
  filesForComponent,
  filesForVariant,
  wrapElementBeforeRender,
  wrapHtmlAfterRender
}
