# Build script adpated from http://github.com/jashkenas/coffee-script/Cakefile
# ==============================================================================

fs            = require 'fs'
util          = require 'util'
{spawn, exec} = require 'child_process'


# Commands
compressionCmd = ->
  "java -jar ./lib/compiler.jar --js data.js --js_output_file data.min.js"

# Run a CoffeeScript through the node/coffee interpreter.
run = (args) ->
  proc =         spawn 'bin/coffee', args
  proc.stderr.on 'data', (buffer) -> puts buffer.toString()
  proc.on        'exit', (status) -> process.exit(1) if status != 0

# Log a message with a color.
log = (message, color, explanation) ->
  console.log "#{color or ''}#{message} #{explanation or ''}"

task 'build', 'Build a compressed version', ->
  exec compressionCmd(), (err, stdout, stderr) ->
    throw err if err
    log 'Sucessfully built data.min.js'
