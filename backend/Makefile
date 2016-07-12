
UNAME := $(shell uname -s)
.PHONY: all
all: depend bin

buildtargets = libargo-backend.dylib argo-backend argo-live-backend argo-run-one notify-live.cgi
.PHONY: bin
bin: $(buildtargets)

#IGNORE := $(shell bash -c "source root/bin/thisroot.sh; env | sed 's/=/:=/' | sed 's/^/export /' > makeenv") 
#include makeenv 

pwd := $(shell pwd)

ifeq ($(origin UBOONEDAQ_DATATYPES_DIR), undefined)
  uboonedaq           = $(HOME)/ubdaq/uboonedaq/projects
  uboonedaq_datatypes_src = $(HOME)/ubdaq/uboonedaq-datatypes/projects
  uboonedaq_datatypes_inc = $(HOME)/ubdaq/uboonedaq-datatypes/projects
else
  uboonedaq           = $(UBOONEDAQ_DIR)/source
  uboonedaq_datatypes_src = $(UBOONEDAQ_DATATYPES_DIR)/source
  uboonedaq_datatypes_inc = $(UBOONEDAQ_DATATYPES_DIR)/include
endif

#ifeq ($(origin UBOONEDAQ_DIR), undefined)
  uboonedaq           = $(HOME)/ubdaq/uboonedaq/projects
#else
#  uboonedaq           = $(UBOONEDAQ_DIR)/source
#endif


#override, since setup is poor.
#uboonedaq  = $(HOME)/development/uboonedaq/projects

CPPFLAGS := -g -I.. -Wno-deprecated-declarations 
#CPP := g++44 -std=c++0x
CPP := g++ -std=c++1y -O3
LD := $(CPP)
shlibsuffix=so
LDFLAGS = -g 


ifeq ($(UNAME),Darwin)
  CPP = clang++ -std=c++1y -Wno-return-type-c-linkage 
  LD = clang++ -std=c++1y
  LDFLAGS = -bind_at_load -g
else 
  CPPFLAGS += -fPIC
  LDFLAGS += -lgomp -fPIC
endif


SOURCES = $(notdir $(wildcard *.cpp)) \
          $(notdir $(wildcard $(uboonedaq_datatypes_src)/datatypes/*.cpp)) \
          DaqFile.cpp \
          Plexus.cpp  \
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
tmp/FormString.o    tmp/SocketServer.o      tmp/WirePalette.o \
tmp/FormulaLooter.o tmp/Timer.o 	    tmp/crc32checksum.o\
tmp/JsonElement.o   tmp/RecordComposer.o    tmp/TreeElementLooter.o \
tmp/DeadChannelMap.o \
tmp/Cint.o 

#Where to look for source files
vpath %.cpp $(uboonedaq_datatypes_src)/datatypes
vpath %.cpp $(uboonedaq)/dispatcher
vpath %.cpp $(uboonedaq)/online_monitor
#Where to look for include files

CPPFLAGS += -I $(uboonedaq)
CPPFLAGS += -I $(uboonedaq_datatypes_inc)
CPPFLAGS += -D nullptr=0


# Don't use the default FCL and messagelogger.
CPPFLAGS += -D NO_MSGLOG=1 -D NO_FCL=1

# Boost.
BOOST_INC ?= boost/include # Usually defined for us, use local symlink ./boost if not
BOOST_LIB ?= boost/lib

BLIBS += -lboost_serialization -lboost_system -lboost_thread -lboost_program_options
# LIBS += -lboost_serialization -lboost_system -lboost_thread

ifeq ($(UNAME),Darwin)
  LDFLAGS += -Wl,-rpath,@executable_path/boost/lib/ 
  CPPFLAGS +=  -ftemplate-depth=512
endif

CPPFLAGS += -I $(BOOST_INC) 
BLIBS += -L ${BOOST_LIB}


# Root.
ifeq ($(origin ROOTSYS), undefined)
		export ROOTSYS ?= ${pwd}/root  # Usually defined for us, use local symlink ./root if not
			export LD_LIBRARY_PATH+=${ROOTSYS}/lib
endif

ifeq ($(UNAME),Darwin)
	# LDFLAGS += -Wl,-rpath,root -Wl,-rpath,$(ROOTSYS)
endif

PATH+=:${ROOTSYS}/bin
LIBS  += -L/usr/X11R6/lib $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --libs )  -lTreePlayer -lTreeViewer
LDFLAGS += $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --ldflags)
CPPFLAGS += $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --cflags) -I/opt/X11/include

### LarLite
## comment out this section if larlite not available
## symlink larlite to current directory
CPPFLAGS += -DLARLITE=1
LARLITE_PATH = ./larlite
CPPFLAGS += -I $(LARLITE_PATH)/core
LIBS += -L$(LARLITE_PATH)/lib -lLArLite_DataFormat -lLArLite_Base
LDFLAGS += 	-Wl,-rpath,larlite/lib/

# add any other desired libs here
# PNG
LIBS += -L/opt/X11/lib -lpng -lcrypto


CPPFLAGS := $(filter-out -stdlib=libc++,$(CPPFLAGS))
LDFLAGS := $(filter-out -stdlib=libc++,$(LDFLAGS))
LIBS := $(filter-out -stdlib=libc++,$(LIBS))

# postgresql
ifeq ($(UNAME),Darwin)
  # Use the Postgres app, instead of a fullblown installation.
#  BLIBS +=  -L/Applications/Postgres.app/Contents/MacOS/lib -lpq
  CPPFLAGS += -I/Applications/Postgres.app/Contents/MacOS/include
endif
ifneq ($(origin POSTGRESQL_INC), undefined)
	CPPFLAGS += -I ${POSTGRESQL_INC} 
	BLIBS += -L $(POSTGRESQL_LIBRARIES) -lpq
else 
  BLIBS += -lpq
endif

ifneq ($(origin SQLITE_INC), undefined)	
         CPPFLAGS += -I ${SQLITE_INC} 
         BLIBS += -L ${SQLITE_LIB}  -lsqlite3_ups
else
         BLIBS += -lsqlite3
endif

#libcurl
BLIBS += -lcurl


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
RHEADERS = 
Cint.cpp : $(RHEADERS) LinkDef.h
	@echo "Running rootcint... " $(RHEADERS) LinkDef.h
	#export LD_LIBRARY_FLAGS+=${ROOTSYS}/lib
	rootcint -v3 -f $@ -c -g -I./ -pthread -m64 $(RHEADERS) LinkDef.h
	
tmp/Cint.o : Cint.cpp
	$(CPP) $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --cflags) -fPIC -c $< -o $@



argo-backend: $(OBJ) tmp/argo-backend.o Makefile
	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) $(BLIBS) -o $@

# Now integrated into main build
#argo-raw-backend: $(OBJ) tmp/argo-raw-backend.o Makefile
#	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) $(BLIBS) -o $@

argo-live-backend: $(OBJ) tmp/argo-live-backend.o Makefile
	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) $(BLIBS) -o $@


argo-run-one: $(OBJ) tmp/argo-run-one.o Makefile
	$(CPP) $(LDFLAGS) \
	-Wl,-rpath,@loader_path/deps/root/lib \
	-Wl,-rpath,@loader_path/deps/boost/lib \
	-Wl,-rpath,@loader_path/../../deps/root/lib\
	-Wl,-rpath,@loader_path/../../deps/root/lib\
	-Wl,-rpath,@loader_path/../../deps/root/lib\
	-Wl,-rpath,@loader_path/root/lib\
	-Wl,-rpath,@loader_path/boost/lib\
	 $(filter %.o,$^) $(LIBS) $(BLIBS) -o $@

libargo-backend.dylib: $(OBJ) tmp/Cint.o Makefile
	$(CPP) -shared $(LDFLAGS) $(filter %.o,$^) -o $@  $(LIBS) $(BLIBS)

testbin: $(OBJ) tmp/argo-backend.o Makefile
	$(CPP) tmp/argo-backend.o $(LDFLAGS) -L. -largo-backend $(LIBS) $(BLIBS) -o $@


notify-live.cgi:  tmp/notify_live.o
	$(CPP) $(filter %.o,$^) -o $@  
  


myroot: $(backend_obj) tmp/myroot-main.o tmp/Cint.o Makefile
	@echo "Building " $@ $(OBJ)
	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) -o $@

testx: $(OBJ) tmp/test-main.o tmp/Cint.o Makefile
	@echo "Building " $@ $(OBJ)
	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) -o $@


install-boost: Makefile
	#Thing for Mac OSX; change the internal name of the boost libraries.
	install_name_tool -id @rpath/libboost_serialization.dylib ${BOOST_LIB}/libboost_serialization.dylib
	install_name_tool -id @rpath/libboost_system.dylib ${BOOST_LIB}/libboost_system.dylib
	install_name_tool -id @rpath/libboost_thread.dylib ${BOOST_LIB}/libboost_thread.dylib
	install_name_tool -id @rpath/libboost_program_options.dylib ${BOOST_LIB}/libboost_program_options.dylib

depend: $(DEPS)

printenv: 
	@echo " CPPFLAGS = $(CPPFLAGS) "
	@echo " LIBS = $(LIBS)"
	@echo " Sources: $(SOURCES)"
	@echo " Objects: $(OBJ)"
	@echo " RHEADERS = $(RHEADERS)"

clean:
	rm -rf tmp/*
