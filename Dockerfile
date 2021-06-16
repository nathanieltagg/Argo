FROM uboone_plus_node

# this will be the working directory when container is run
WORKDIR /Argo

# copy it from here.
COPY . /Argo


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
EXPOSE 4590

CMD /usr/bin/nodemon
