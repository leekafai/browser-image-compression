import imageCompression from './index'
import compress from './image-compression'
import { getNewCanvasAndCtx } from './utils'

let cnt = 0
let imageCompressionLibUrl

function createWorker(f) {
  return new Worker(URL.createObjectURL(new Blob([`(${f})()`])))
}

const worker = createWorker(() => {
  let scriptImported = false
  self.addEventListener('message', async (e) => {
    const { file, id, imageCompressionLibUrl, options } = e.data
    try {
      if (!scriptImported) {
        // console.log('[worker] importScripts', imageCompressionLibUrl)
        self.importScripts(imageCompressionLibUrl)
        scriptImported = true
      }
      // console.log('[worker] self', self)
      options.progress = (p) => {
        // console.log('worker id', id)
        // console.log('worker progress report', p)
        self.postMessage({ progress: p, id })
      }
      const compressedFile = await imageCompression(file, options)
      self.postMessage({ file: compressedFile, id, finish: true })
    } catch (e) {
      // console.error('[worker] error', e)
      self.postMessage({ error: e.message + '\n' + e.stack, id })
    }
  })
})

function createSourceObject(str) {
  return URL.createObjectURL(new Blob([str], { type: 'application/javascript' }))
}

export function compressOnWebWorker(file, options) {

  return new Promise(async (resolve, reject) => {
    if (!imageCompressionLibUrl) {
      imageCompressionLibUrl = createSourceObject(`
    function imageCompression (){return (${imageCompression}).apply(null, arguments)}

    imageCompression.getDataUrlFromFile = ${imageCompression.getDataUrlFromFile}
    imageCompression.getFilefromDataUrl = ${imageCompression.getFilefromDataUrl}
    imageCompression.loadImage = ${imageCompression.loadImage}
    imageCompression.drawImageInCanvas = ${imageCompression.drawImageInCanvas}
    imageCompression.drawFileInCanvas = ${imageCompression.drawFileInCanvas}
    imageCompression.canvasToFile = ${imageCompression.canvasToFile}
    imageCompression.getExifOrientation = ${imageCompression.getExifOrientation}
    imageCompression.handleMaxWidthOrHeight = ${imageCompression.handleMaxWidthOrHeight}
    imageCompression.followExifOrientation = ${imageCompression.followExifOrientation}

    getDataUrlFromFile = imageCompression.getDataUrlFromFile
    getFilefromDataUrl = imageCompression.getFilefromDataUrl
    loadImage = imageCompression.loadImage
    drawImageInCanvas = imageCompression.drawImageInCanvas
    drawFileInCanvas = imageCompression.drawFileInCanvas
    canvasToFile = imageCompression.canvasToFile
    getExifOrientation = imageCompression.getExifOrientation
    handleMaxWidthOrHeight = imageCompression.handleMaxWidthOrHeight
    followExifOrientation = imageCompression.followExifOrientation

    getNewCanvasAndCtx = ${getNewCanvasAndCtx}
    
    CustomFileReader = FileReader
    
    CustomFile = File
    
    function _slicedToArray(arr, n) { return arr }

    function compress (){return (${compress}).apply(null, arguments)}
    `)
    }
    let id = cnt++

    function handler(e) {
      if (e.data.id === id && typeof options.progress === 'function' && e.data.progress >= 0) {
        options.progress(e.data.progress)
      }
      if (e.data.id === id && e.data.finish) {
        worker.removeEventListener('message', handler)
        if (e.data.error) {
          reject(new Error(e.data.error))
        }
        typeof options.progress === 'function' && options.progress(100)
        resolve(e.data.file)
      }
    }
    worker.addEventListener('message', handler)
    worker.postMessage({ file, id, imageCompressionLibUrl, options: Object.assign({}, options, { progress: undefined }) })
  })
}