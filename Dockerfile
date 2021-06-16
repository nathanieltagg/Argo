## How to build a docker image
## Check out a clean copy of the argo repository.
## docker build -t argo .
## To open the current directory as the /data directory in the VM:nano 
## docker run -it  -p 4590:4590 -v "$(pwd):/data" argo:latest
## In browser, open localhost:4590/browser/data

## For development work, build only argo-build stage
## (Using - as the build context and piping in the Dockerfile means no
## slow copy of the local context, which is nice.) 
## cat Dockerfile | docker build --target builder -t argodev -
## docker run -it  -p 4590:4590 -v "$(pwd):/Argo" -v "/Users/tagg/argo-test-files:/data" argodev

FROM fnalart/uboone:v08_30_02-s86-e17-prof-slf7 as builder

RUN curl -sL https://rpm.nodesource.com/setup_14.x | bash -
RUN yum install -y nodejs
RUN npm install -g nodemon node-gyp
RUN yum install -y python3
WORKDIR /Argo
EXPOSE 4590
CMD /bin/bash

FROM builder as argo-built
# install node requirements, build the shim code that runs libargo
WORKDIR /Argo
COPY . .
RUN touch config.js
RUN /bin/bash -c  "source setup.sh.docker && cd libargo && make"
RUN /bin/bash -c  "source setup.sh.docker && npm install"

FROM argo-built as argo

# delete some crap 
# Dont' use indvidual RUN directives since each one will cause some effect.
RUN rm -rf /products/*/*/source \
 && rm -rf /products/larreco \ 
  /products/cmake \ 
  /products/genie_xsec \ 
  /products/ubana \
  /products/valgrind \
  /products/g4tendl \
  /products/g4neutron \
  /products/wirecell \
  /products/geant4 \
  /products/genie \
  /products/gdb \
  /products/larpandora \
  /products/fftw \
  /products/g4emlow \
  /products/g4photon \
  /products/tensorflow \
  /products/artg4tk /products/xerces_c \
  /products/ubcrt /products/protobuf/ \
 && rm /Argo/libargo/tmp/*

# port on host will be port on container

CMD /bin/bash -c "source setup.sh.docker && /usr/bin/nodemon"
