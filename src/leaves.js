const BATCH_SIZE = 1024
const { format } = require('js-conflux-sdk')
const { methods } = require('./adapter.js')

async function fetchLeaves(tree, batch_size) {
  batch_size = batch_size || BATCH_SIZE
  const size = await methods(tree).nextIndex().call()
  const batches = Math.ceil(format.uInt(size) / batch_size)
  var tasks = []
  for (i = 0; i < batches; i++) {
    tasks.push(
      methods(tree)
        .leafSlice(i * batch_size, (i + 1) * batch_size)
        .call(),
    )
  }
  var answers = await Promise.all(tasks)
  return answers.flat().map((e) => format.hex(e))
}
module.exports = { fetchLeaves }
