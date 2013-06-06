pwd := $(shell pwd)
export ROOTSYS := ${pwd}/root

UNAME := $(shell uname -s)


CPP = g++44 --std=c++0x
LD = g++44

ifeq ($(UNAME),Darwin)
  CPP = clang++ -std=c++11 -g 
  LD = clang++ 
endif

PATH+=:${ROOTSYS}/bin
export LD_LIBRARY_PATH=${ROOTSYS}/lib
# My includes
LDFLAGS = -g 

shlibsuffix=so
platform=$(shell uname -s)

ifeq ($(platform),Darwin)
  shlibsuffix=dylib
  LDFLAGS = -bind_at_load -g
endif

# ROOT
CPPFLAGS := -g -I./ $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --cflags) -I/opt/X11/include
LIBS := -L/usr/X11R6/lib -lTreePlayer $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --libs --cflags)\
        -L/opt/X11/lib -lpng # add any other desired libs here

#Sources
SOURCES = $(notdir $(wildcard *.cpp))
BINSOURCES = $(notdir $(wildcard *.cc))
#SOURCES = root_server.cpp SocketServer.cpp Timer.cpp make_xml.cpp
OBJ = $(addprefix tmp/, $(patsubst %.cpp,%.o,$(SOURCES)) )
BINOBJ = $(addprefix tmp/, $(patsubst %.cc,%.o,$(BINSOURCES)) )
DEPS= $(addprefix tmp/, $(patsubst %.cpp,%.d,$(SOURCES)) )

#Headers:
ALLHEADERS = $(wildcard *.h)
#RHEADERS = $(filter-out LinkDef.h, $(ALLHEADERS)) 
RHEADERS = JsonElement.h  
#Add Rootcint
CINTOBJ = tmp/Cint.o

.PHONY: all
all: depend bin

#Dependency rule
$(DEPS) : tmp/%.d : %.cpp
	@mkdir -p tmp
	@echo "Building dependency $@ $< %.o"
	echo "ROOTSYS is $$ROOTSYS"
	@echo $(CPPFLAGS)
	$(CPP) -M -MT $(patsubst %.cpp,tmp/%.o,$<) $(CPPFLAGS) -o $@ -c $<

ifneq ($(DEPS),)
-include $(DEPS)
endif

#Compilation rule
$(OBJ) : tmp/%.o : %.cpp
	@mkdir -p tmp
	@echo "compiling $@ $<"
	$(CPP) $(CPPFLAGS) -o $@ -c $<


$(BINOBJ) : tmp/%.o : %.cc
	@mkdir -p tmp
	@echo "compiling $@ $<"
	$(CPP) $(CPPFLAGS) -o $@ -c $<


#Rootcint rule:
tmp/Cint.cpp : $(RHEADERS) LinkDef.h
	@echo "Running rootcint... " $(RHEADERS) LinkDef.h
	LD_LIBRARY_FLAGS=${ROOTSYS}/lib
	rootcint -v3 -f $@ -c $(CPPFLAGS) $(RHEADERS) LinkDef.h

	
$(CINTOBJ): tmp/Cint.cpp
	@echo "Compiling Cint object"
	$(CPP) $(CPPFLAGS) -o $@ -c $<


.PHONY: bin
bin: histserver histquick myroot 
histserver: $(OBJ) tmp/hist-server-main.o Makefile
	@echo "Building " $@ $(OBJ)
	$(CPP) $(LDFLAGS) $(OBJ) tmp/hist-server-main.o $(LIBS) $(LIBS) -o $@

histquick: $(OBJ) tmp/hist-quick-main.o Makefile
	@echo "Building " $@ $(OBJ)
	$(CPP) $(LDFLAGS) $(OBJ) tmp/hist-quick-main.o $(LIBS) $(LIBS) -o $@

myroot: $(OBJ) tmp/myroot-main.o tmp/Cint.o Makefile
	@echo "Building " $@ $(OBJ)
	$(LD) $(LDFLAGS) $(OBJ) tmp/myroot-main.o tmp/Cint.o $(LIBS) $(LIBS) -o $@


depend: $(DEPS)

printenv: 
	@echo " CPPFLAGS = $(CPPFLAGS) "
	@echo " LIBS = $(LIBS)"
	@echo " SOURCES = $(SOURCES)"
	@echo " OBJECTS = $(OBJ)"
	@echo " RHEADERS = $(RHEADERS)"

clean:
	rm -rf tmp/*
