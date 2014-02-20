
.PHONY: all
all: depend bin

pwd := $(shell pwd)
uboonedaq           = $(HOME)/ubdaq/uboonedaq
uboonedaq_datatypes = $(HOME)/ubdaq/uboonedaq-datatypes
CPPFLAGS := -g -I..
CPP := g++44 -std=c++0x
LD := $(CPP)
shlibsuffix=so
LDFLAGS = -g 

UNAME := $(shell uname -s)

ifeq ($(UNAME),Darwin)
  CPP = c++ -std=c++11 -stdlib=libc++
  LD = c++ -std=c++11 -stdlib=libc++
  shlibsuffix=dylib
  LDFLAGS = -bind_at_load -g
endif


SOURCES = $(notdir $(wildcard *.cpp)) \
          $(notdir $(wildcard $(uboonedaq_datatypes)/projects/datatypes/*.cpp)) \
          Plexus.cpp \
          Client.cpp \
          DispatcherMessage.cpp \
          KvpSet.cpp \
          Logging.cpp \
          ConvertDispatcherToEventRecord.cpp \
          Timer.cpp \

OBJ =  $(addprefix tmp/, $(patsubst %.cpp,%.o,$(SOURCES)) ) 
DEPS = $(patsubst %.o,%.d,$(wildcard tmp/*.o))

backend_obj = \
tmp/MakePng.o       tmp/ResultComposer.o    tmp/TreeReader.o \
tmp/ColorMap.o      tmp/RootToJson.o        tmp/cencode.o \
tmp/FormString.o    tmp/SocketServer.o \
tmp/FormulaLooter.o tmp/Timer.o \
tmp/JsonElement.o   tmp/RecordComposer.o    tmp/TreeElementLooter.o

#Where to look for source files
vpath %.cpp $(uboonedaq_datatypes)/projects/datatypes
vpath %.cpp $(uboonedaq)/projects/dispatcher
vpath %.cpp $(uboonedaq)/projects/online_monitor
#Where to look for include files
CPPFLAGS += -I $(uboonedaq)/projects
CPPFLAGS += -I $(uboonedaq_datatypes)/projects

# Don't use the default FCL and messagelogger.
CPPFLAGS += -D NO_MSGLOG=1 -D NO_FCL=1

# Boost.
MY_BOOST_DIR ?= boost
CPPFLAGS += -I $(MY_BOOST_DIR)/include
LIBS += -lboost_serialization -lboost_system -lboost_thread
ifeq ($(UNAME),Darwin)
  LIBS += -Wl,-rpath,@executable_path/boost/lib 
endif
CPPFLAGS += -I/$(MY_BOOST_DIR)/include -ftemplate-depth=512
LIBS += -L $(MY_BOOST_DIR)/lib 

# Root.
export ROOTSYS ?= ${pwd}/root
export LD_LIBRARY_PATH=${ROOTSYS}/lib
ifeq ($(UNAME),Darwin)
	LDFLAGS += -Wl,-rpath,root -Wl,-rpath,$(ROOTSYS)
endif
PATH+=:${ROOTSYS}/bin
LIBS  += -L/usr/X11R6/lib -lTreePlayer $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --libs )  
LDFLAGS += $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --ldflags)
CPPFLAGS += $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --cflags) -I/opt/X11/include


# add any other desired libs here
# PNG
LIBS += -L/opt/X11/lib -lpng 

# postresql
ifeq ($(UNAME),Darwin)
  # Use the Postgres app, instead of a fullblown installation.
  LIBS +=  -L/Applications/Postgres.app/Contents/MacOS/lib
  CPPFLAGS += -I/Applications/Postgres.app/Contents/MacOS/include
endif
LIBS += -lpq
	

#Dependency rule
tmp/%.d : %.cpp
	@mkdir -p tmp
	@echo "Building cpp dependency $@ $<"
	@$(CPP) -M -MT $(patsubst %.cpp,tmp/%.o,$<) $(CPPFLAGS) -o $@ -c $<

tmp/%.d : %.cc
	@mkdir -p tmp
	@echo "Building cc dependency $@ $< %.o"
	@$(CPP) -M -MT $(patsubst %.cc,tmp/%.o,$<) $(CPPFLAGS) -o $@ -c $<

ifneq ($(DEPS),)
-include $(DEPS)
endif


#Compilation rule
tmp/%.o : %.cpp
	@mkdir -p tmp
	@echo "compiling $@ $<"
	$(CPP) $(CPPFLAGS) -o $@ -c $<

tmp/%.o : %.cc
	@mkdir -p tmp
	@echo "compiling $@ $<"
	$(CPP) $(CPPFLAGS) -o $@ -c $<


#Rootcint rule:
RHEADERS = JsonElement.h FormulaLooter.h
Cint.cpp : $(RHEADERS) LinkDef.h
	@echo "Running rootcint... " $(RHEADERS) LinkDef.h
	LD_LIBRARY_FLAGS=${ROOTSYS}/lib
	rootcint -v3 -f $@ -c -g -I./ -pthread -m64 $(RHEADERS) LinkDef.h
	
tmp/Cint.o : Cint.cpp
	$(CPP) $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --cflags) -c $< -o $@ 



.PHONY: bin
bin: argo-backend argo-raw-backend myroot testx
argo-backend: $(backend_obj) tmp/argo-backend.o Makefile
	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) -o $@

argo-raw-backend: $(OBJ) tmp/argo-raw-backend.o Makefile
	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) -o $@

myroot: $(OBJ) tmp/myroot-main.o tmp/Cint.o Makefile
	@echo "Building " $@ $(OBJ)
	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) -o $@

testx: $(OBJ) tmp/test-main.o tmp/Cint.o Makefile
	@echo "Building " $@ $(OBJ)
	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) -o $@

depend: $(DEPS)

printenv: 
	@echo " CPPFLAGS = $(CPPFLAGS) "
	@echo " LIBS = $(LIBS)"
	@echo " Sources: $(SOURCES)"
	@echo " Objects: $(OBJ)"
	@echo " RHEADERS = $(RHEADERS)"

clean:
	rm -rf tmp/*
