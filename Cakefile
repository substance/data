# Build script adpated from http://github.com/jashkenas/coffee-script/Cakefile
# ==============================================================================

fs            = require 'fs'
sys           = require 'sys'
CoffeeScript  = require 'coffee-script'
{spawn, exec} = require 'child_process'


# ANSI terminal colors.
red   = '\033[0;31m'
green = '\033[0;32m'
reset = '\033[0m'

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
  console.log "#{color or ''}#{message}#{reset} #{explanation or ''}"

task 'build', 'Build a compressed version', ->
  exec compressionCmd(), (err, stdout, stderr) ->
    throw err if err
    log 'Sucessfully built data.min.js', green
