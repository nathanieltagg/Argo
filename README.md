# ARGO - The MicroBooNE Online Event Display
This project is the Argo online web-based event display for the 
MicroBooNE neutrino experiment.

# Argo public installation

Argo is supposed to be public, at
  https://argo-microboone.fnal.gov/
However, Fermilab sometimes has this system locked out from the general public for various reasons.

# Running argo yourself

If you want to run Argo on your own laptop, the easiest way is by using a Docker image.
- Install Docker
- On your command line, do 
  ```
    docker pull nathanieltagg/argo:latest
  ```
- When the download is complete, run it.
  ```
    cd <my directory with microboone data>
    docker run -it  -p 4590:4590 -v "$(pwd):/data" nathanieltagg/argo
  ```
  It will take a few seconds to start up, but eventually say it is running on port 4590.
  (I use 4590 because that number looks vaguely like "Argo" if you squint)
- Open a browser window at http://localhost:4590/browser/data

# Installation

Although this was developed on a Mac OSX system, Fermilab no longer officially supports it and it hasn't worked properly for several iterations of OSX 10.x, and Big Sur will break it completely.  Going that route requires installation of xcode tools and running xcode-select, and may require you to install older system headers so that the larsoft libraries can compile.

Installation on your own system requires these steps:
- Install larsoft and uboonecode. Follow directions for your system.
- Install node.js.  Currently supported version is node 12 LTS
- Create a my.setup.sh script, by modifying the setup.sh.* examples here.  This sets up your environment for the larsoft libraries.
- `source my.setup.sh`
- `cd libargo && make`
- `npm install`
- `touch config.js` (the defaults are probably fine)
- If those steps succeed, then you're ready to run, using  `node index.js` or use nodemon
- Connect to your local server as above on http://localhost:4590

# Development via docker

To develop the code via docker, these steps work:
- From this directory, construct a docker image with the base installation  
  ```
  cat Dockerfile | docker build --target builder -t argodev -
  ```
- Start the instance:  
  ```
  docker run -it  -p 4590:4590 -v "$(pwd):/Argo" -v "/Users/tagg/argo-test-files:/data" argodev
  ```
- From inside the container,  
  ```
   source setup.sh.docker
   touch setup.sh
   cd libargo && make
   cd /Argo && npm install
   nodemon
   ```
The actual source files reside outside the container and so can be edited as normal, so this process isn't too arduous.

# Directory Structure

`libargo` contains the C++ code that is used to change a larsoft event into a JSON file.  This code is extremely complex now, since it allows incremental unpacking of the single event.
`argonode` contains the shim code to hook the C++ into node javascript wrappers. Building this requires node-gyp
`db` contains my version of the channel mapping for MicroBooNE
`pug` contains the Pug templates for the important pages
`samspider` contains some hybrid code for walking through SAMWEB definitions, since it's impossible to navigate by hand...
`scss` has scss style sheets, which are compiled dynamically at runtime
`static` contains all files served to clients statically, including all the client-side javascript code, images, and 3d models
`tools` are some offline tools for development work
`masterclass_data` contains links to useful events for the Argo MasterClass exercises
`datacache` is a directory which caches image data (wire view images) on load
`apache` contains files useful for configuring an apache reverseproxy
`index.js` is the main code for serving event data
`browser.js` is the main code for serving the file browser
`configuration.js` includes default configuration, and will load `config.js` to override those settings.git pu

# About
This code was written by Nathaniel Tagg (nathaniel.tagg@gmail.com) and with contributions from undergraduate students, including Jiyu Li, Phillip Kellogg, Curtis Brown, Molly Clairemont, Jack Brangham, and Erin Cochran.

Files in the js/ directory include some third-party libraries, included in the repository for ease of installation.

This code can only be used with permission of the maintainer, who takes no responsibility
for it being readable, sensible, or any proclivity for it to summon Ancient Old Ones 
to destroy humanity. Your Sanity May Be At Risk.  Abandon all hope, yadda yadda yadda.

If you use this work for your own projects, you are required to put attribution to us somewhere
on your main page.


Work on this project is based off of the Arachne event display for Minerva, by the same author.

A technical paper describing the operation of the original Minerva/Arachne system was published in 
Nucl.Inst.Meth. 676 (2012) 44-49, and is available on the arXiv at http://arxiv.org/abs/1111.5315


--Nathaniel


