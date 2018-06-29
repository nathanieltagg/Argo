
UNAME := $(shell uname -s)
.PHONY: all
all: depend bin

buildtargets = libargo-backend.dylib argo-backend argo-live-backend argo-run-one notify-live.cgi
.PHONY: bin
bin: $(buildtargets)

#IGNORE := $(shell bash -c "source root/bin/thisroot.sh; env | sed 's/=/:=/' | sed 's/^/export /' > makeenv") 
#include makeenv 

pwd := $(shell pwd)

# ifeq ($(origin UBOONEDAQ_DATATYPES_DIR), undefined)
#   uboonedaq           = $(HOME)/ubdaq/uboonedaq/projects
#   uboonedaq_datatypes_src = $(HOME)/ubdaq/uboonedaq-datatypes/projects
#   uboonedaq_datatypes_inc = $(HOME)/ubdaq/uboonedaq-datatypes/projects
# else
#   uboonedaq           = $(UBOONEDAQ_DIR)/source
#   uboonedaq_datatypes_src = $(UBOONEDAQ_DATATYPES_DIR)/source
#   uboonedaq_datatypes_inc = $(UBOONEDAQ_DATATYPES_DIR)/include
# endif

#ifeq ($(origin UBOONEDAQ_DIR), undefined)
  uboonedaq           = $(HOME)/ubdaq/uboonedaq/projects
#else
#  uboonedaq           = $(UBOONEDAQ_DIR)/source
#endif


#override, since setup is poor.
#uboonedaq  = $(HOME)/development/uboonedaq/projects

# CPPFLAGS := -g -I.. -Wno-error-deprecated-declarations
#CPP := g++44 -std=c++0x
CPP := g++ -std=c++1y -O0
LD := $(CPP)
shlibsuffix=so
LDFLAGS = -g 


ifeq ($(UNAME),Darwin)
  CPP = clang++ 
  # -gdwarf-4 -std=c++98 -std=c++17 -isysroot /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.12.sdk 
  # LD = clang++ -std=c++1y
  # CPPFLAGS += -fPIC -g
  LDFLAGS = -prebind   -g
  CPPFLAGS += -I /usr/local/opt/openssl/include
else 
  CPPFLAGS += -fPIC
  LDFLAGS += -lgomp -fPIC
endif

CPPFLAGS += -Wno-return-type-c-linkage


SOURCES = $(notdir $(wildcard *.cpp)) \
          # $(notdir $(wildcard $(uboonedaq_datatypes_src)/datatypes/*.cpp)) 

UBOONEDAQ_FILES =DaqFile.cpp Plexus.cpp Plexus_hardcoded.h  Client.cpp DispatcherMessage.cpp KvpSet.cpp Logging.cpp ConvertDispatcherToEventRecord.cpp #Timer.cpp 
UBOONEDAQ_FILES +=DaqFile.h Plexus.h  Client.h DispatcherMessage.h KvpSet.h Logging.h ConvertDispatcherToEventRecord.h #Timer.h 

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
# vpath %.cpp $(uboonedaq_datatypes_src)/datatypes


# vpath %.cpp $(uboonedaq)/dispatcher
# vpath %.cpp $(uboonedaq)/online_monitor

#Where to look for include files

# CPPFLAGS += -I $(uboonedaq)
# CPPFLAGS += -I $(uboonedaq_datatypes_inc)
# CPPFLAGS += -D nullptr=0


# Don't use the default FCL and messagelogger.
CPPFLAGS += -D NO_MSGLOG=1 -D NO_FCL=1


LIBS  += -L/usr/X11R6/lib $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --libs )  -lTreePlayer -lTreeViewer
LDFLAGS += $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --ldflags)

### Products added via ups
CPPFLAGS += -I ${BOOST_INC}
LIBS     += -L ${BOOST_LIB}  -lboost_serialization -lboost_system -lboost_thread -lboost_program_options
CPPFLAGS += -I ${HEP_CONCURRENCY_INC}
LIBS     += -L ${HEP_CONCURRENCY_LIB} -l hep_concurrency
CPPFLAGS += -I ${CANVAS_ROOT_IO_INC} 
LIBS     += -L ${CANVAS_ROOT_IO_LIB} -l canvas_root_io
CPPFLAGS += -I ${GALLERY_INC}
LIBS     += -L ${GALLERY_LIB} -l gallery 
CPPFLAGS += -I ${CANVAS_INC}
LIBS     += -L ${CANVAS_LIB} -l canvas
CPPFLAGS += -I ${LARDATAOBJ_INC}
LIBS     += -L ${LARDATAOBJ_LIB} -l lardataobj_RecoBase
CPPFLAGS += -I ${LARCOREOBJ_INC}
CPPFLAGS += -I ${NUSIMDATA_INC} 
LIBS     += -L ${NUSIMDATA_LIB} -l nusimdata_SimulationBase
CPPFLAGS += -I ${CETLIB_INC}          -I ${CETLIB_EXCEPT_INC}
LIBS     += -L ${CETLIB_LIB_DIR} -lcetlib -L ${CETLIB_EXCEPT_LIB} -lcetlib_except
CPPFLAGS += -I ${FHICLCPP_INC}
CPPFLAGS += -I ${UBOONECODE_INC}
LIBS     += -L ${UBOONECODE_LIB} -l uboone_RawData_utils_dict -l uboone_RawData
CPPFLAGS += -I ${UBOONEDAQ_DATATYPES_INC}
LIBS     += -L ${UBOONEDAQ_DATATYPES_LIB} -l ubdata_types
CPPFLAGS += -I ${ROOT_INC}

CPPFLAGS += -I ${POSTGRESQL_INC}
LIBS     += -L ${POSTGRESQL_LIBRARIES} -lpq
CPPFLAGS += -I ${SQLITE_INC} 
LIBS     += -L ${SQLITE_LIB} -lsqlite3_ups

CPPFLAGS += -DGALLERY
# LIBS += -lgomp

## LARLITE is optional.
ifneq ($(origin LARLITE_DIR), undefined)
  CPPFLAGS += -DLARLITE=1
  CPPFLAGS += -I  ${LARLITE_COREDIR}
  LIBS += -L${LARLITE_LIBDIR} -lLArLite_DataFormat -lLArLite_Base
endif


CPPFLAGS += -I/usr/local/include  # for png.h

# add any other desired libs here
# PNG
LIBS += -L/opt/X11/lib -lpng -lcrypto


# CPPFLAGS := $(filter-out -stdlib=libc++,$(CPPFLAGS))
LDFLAGS := $(filter-out -stdlib=libc++,$(LDFLAGS))
LIBS := $(filter-out -stdlib=libc++,$(LIBS))

# postgresql
# ifeq ($(UNAME),Darwin)
#   # Use the Postgres app, instead of a fullblown installation.
# #  BLIBS +=  -L/Applications/Postgres.app/Contents/MacOS/lib -lpq
#   CPPFLAGS += -I/Applications/Postgres.app/Contents/MacOS/include
# endif
# ifneq ($(origin POSTGRESQL_INC), undefined)
#   CPPFLAGS += -I ${POSTGRESQL_INC}
#   BLIBS += -L $(POSTGRESQL_LIBRARIES) -lpq
# else
#   BLIBS += -lpq
# endif

# ifneq ($(origin SQLITE_INC), undefined)
#          CPPFLAGS += -I ${SQLITE_INC}
#          BLIBS += -L ${SQLITE_LIB}  -lsqlite3_ups
# else
#          BLIBS += -lsqlite3
# endif

#libcurl
BLIBS += -lcurl


ifeq ($(UNAME),Darwin)
  CPPFLAGS += -g -gdwarf-4 -O0 -std=c++98 -Wno-dynamic-exception-spec -Wno-error=deprecated-declarations -pedantic -Wno-unused-local-typedefs -std=c++17 -Wall  -isysroot /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.12.sdk -fPIC
  # -gdwarf-4 -std=c++98 -std=c++17 -isysroot /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.12.sdk 
endif


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
	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) $(BLIBS) -o $@ \
  -Wl,-rpath,${CLHEP_LIB_DIR}

# Now integrated into main build
#argo-raw-backend: $(OBJ) tmp/argo-raw-backend.o Makefile
#	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) $(BLIBS) -o $@

argo-live-backend: $(OBJ) tmp/argo-live-backend.o Makefile
	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) $(BLIBS) -o $@


argo-run-one: $(OBJ) tmp/argo-run-one.o Makefile
	$(CPP) $(LDFLAGS) \
	 $(filter %.o,$^) $(LIBS) $(BLIBS) -o $@
  # -Wl,-rpath,@loader_path/deps/root/lib \
  # -Wl,-rpath,@loader_path/deps/boost/lib \
  # -Wl,-rpath,@loader_path/../../deps/root/lib\
  # -Wl,-rpath,@loader_path/../../deps/root/lib\
  # -Wl,-rpath,@loader_path/../../deps/root/lib\
  # -Wl,-rpath,@loader_path/root/lib\
  # -Wl,-rpath,@loader_path/boost/lib\

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


# This is a brute-force copy.
copy: $(foreach f,$(UBOONEDAQ_FILES),$(wildcard $(uboonedaq)/*/$(f)))
	cp $? .


#$(UBOONEDAQ_FILES:%.cpp): $(wildcard $(uboonedaq)/*/%.cpp)
# 	@echo $?
# 	@echo $(wildcard $(uboonedaq)/*/$@)
# 	@echo "Copying new version of $< $@"
# 	# cp $< $@

# install-boost: Makefile
#   #Thing for Mac OSX; change the internal name of the boost libraries.
#   install_name_tool -id @rpath/libboost_serialization.dylib ${BOOST_LIB}/libboost_serialization.dylib
#   install_name_tool -id @rpath/libboost_system.dylib ${BOOST_LIB}/libboost_system.dylib
#   install_name_tool -id @rpath/libboost_thread.dylib ${BOOST_LIB}/libboost_thread.dylib
#   install_name_tool -id @rpath/libboost_program_options.dylib ${BOOST_LIB}/libboost_program_options.dylib

depend: $(DEPS)

printenv: 
	@echo " CPPFLAGS = $(CPPFLAGS) "
	@echo " LIBS = $(LIBS)"
	@echo " Sources: $(SOURCES)"
	@echo " Objects: $(OBJ)"
	@echo " RHEADERS = $(RHEADERS)"

clean:
	rm -rf tmp/*
