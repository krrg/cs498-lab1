# CS 498R
## Principles of Asynchronous Programming
### Project 1

To run the server in stand-alone mode do, `python server.py`.

The unit tests assume that the server is written with a Python virtualenv called `env` in the current directory with `pyuv` installed.  The tests themselves are written in Node.js with Mocha as the test framework.  


### Project Description

In CS 360 you used OS level polling routines like `select` or `epoll` to write an HTTP server.  In this lab, we will move up a level of abstraction and use a cross-platform library called `libuv` to write a simple key-value store server, after the spirit of Redis.  

`libuv` is the same library that the popular Node.js runtime uses under the hood.  Since `libuv` is a cross-platform library, it hides the operating-system specific polling mechanisms.

The [Redis key-value store](redis.io) is a popular key-value store server running on many popular websites.  Although there are a lot of Redis commands, we will only implement the simplest of commands for this project (the focus is on the asynchronicity, not the details of writing a good key-value store).  To keep things really simple, we will only require you to implement a simple version of `GET`, `SET`, and `DEL`.  

The syntax for the simple version of these commands looks like:

`GET [key]`

`SET [key] [value]`

`DEL [key]`

A command is terminated by a newline (`\n`) character.  

### Language

You may either use C or the Python package that provides bindings to `libuv`,  called `pyuv`.  

### Background Material
To get up to speed on `libuv` and some of the architecture around it, you may find the following useful.

https://nikhilm.github.io/uvbook/

https://youtu.be/nGn60vDSxQ4
