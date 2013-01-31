pwd := $(shell pwd)
export ROOTSYS := ${pwd}/root

PATH+=:${ROOTSYS}/bin
# My includes
LDFLAGS = -g 

shlibsuffix=so
platform=$(shell uname -s)

ifeq ($(platform),Darwin)
  shlibsuffix=dylib
  LDFLAGS = -bind_at_load -g
endif

# ROOT
CPPFLAGS := -g -I./ $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --cflags)
LIBS := -L/usr/X11R6/lib -lTreePlayer $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --libs --cflags)  # add any other desired libs here

#Sources
SOURCES = $(notdir $(wildcard *.cpp))
#SOURCES = root_server.cpp SocketServer.cpp Timer.cpp make_xml.cpp
OBJ = $(addprefix tmp/, $(patsubst %.cpp,%.o,$(SOURCES)) )
DEPS= $(addprefix tmp/, $(patsubst %.cpp,%.d,$(SOURCES)) )

#Headers:
ALLHEADERS = $(wildcard *.h)
RHEADERS = $(filter-out LinkDef.h, $(ALLHEADERS)) 

#Add Rootcint
CINTOBJ = /tmp/Cint.o

.PHONY: all
all: depend bin

#Dependency rule
$(DEPS) : tmp/%.d : %.cpp
	@mkdir -p tmp
	@echo "Building dependency $@ $< %.o"
	echo "ROOTSYS is $$ROOTSYS"
	@echo $(CPPFLAGS)
	g++ -M -MT $(patsubst %.cpp,tmp/%.o,$<) $(CPPFLAGS) -o $@ -c $<

ifneq ($(DEPS),)
-include $(DEPS)
endif

#Compilation rule
$(OBJ) : tmp/%.o : %.cpp
	@mkdir -p tmp
	@echo "compiling $@ $<"
	g++ $(CPPFLAGS) -o $@ -c $<


#Rootcint rule:
tmp/Cint.cpp : $(RHEADERS)
	@echo "Running rootcint... " $(RHEADERS) LinkDef.h
	rootcint -v3 -f $@ -c $(CPPFLAGS) $(RHEADERS) LinkDef.h

	
$(CINTOBJ): tmp/Cint.cpp
	g++ $(CPPFLAGS) -o $@ -c $<


.PHONY: bin
bin: ntuple-server
ntuple-server: $(OBJ) Makefile
	@echo "Building " $@
	g++ $(LDFLAGS) $(OBJ) $(LIBS) $(LIBS) -o $@


depend: $(DEPS)

printenv: 
	@echo " CPPFLAGS = $(CPPFLAGS) "
	@echo " LIBS = $(LIBS)"
	@echo " SOURCES = $(SOURCES)"
	@echo " OBJECTS = $(OBJ)"
	@echo " RHEADERS = $(RHEADERS)"

clean:
	rm -rf tmp/*
