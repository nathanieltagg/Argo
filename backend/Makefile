
UNAME := $(shell uname -s)
.PHONY: all
all: depend bin

buildtargets = libargo-backend.dylib argo-backend argo-live-backend argo-run-one notify-live.cgi
.PHONY: bin
bin: $(buildtargets)

clean:
	rm -rf tmp/*

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
  LDFLAGS =  -g
  CPPFLAGS += -I /usr/local/opt/openssl/include
else 
  CPPFLAGS += -fPIC
  LDFLAGS += -lgomp -fPIC
endif

CPPFLAGS += -Wno-return-type-c-linkage


SOURCES = $(notdir $(wildcard *.cpp)) 


OBJ =  $(addprefix tmp/, $(patsubst %.cpp,%.o,$(SOURCES)) ) 
DEPS = $(patsubst %.o,%.d,$(wildcard tmp/*.o))


# Don't use the default FCL and messagelogger.
CPPFLAGS += -D NO_MSGLOG=1 -D NO_FCL=1

# abortive attempt:

# define myaddpkg
# ifneq ($(origin $(1)_LIB), undefined)
#   LIBS += -L $${$(1)_LIB}
# 	LIBS += $2
# endif
# ifneq ($(origin $(1)_INC), undefined)
#   cadd = -I $${$(1)_INC}
# 	CPPFLAGS += -I $${$(1)_INC}
# endif
#
# endef
#
# $(eval $(call myaddpkg, BOOST                       ,-lboost_serialization -lboost_system -lboost_thread -lboost_program_options))


#ROOT Special:
LIBS  += $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --libs )  -lTreePlayer -lTreeViewer
LDFLAGS += $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --ldflags)
CPPFLAGS += -I ${ROOT_INC}

#nonstandard:
CPPFLAGS += -I ${POSTGRESQL_INC}
LIBS     += -L ${POSTGRESQL_LIBRARIES} -lpq

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
CPPFLAGS += -I ${LARCOREALG_INC}
LIBS     += -L ${LARCOREALG_LIB} -l larcorealg_Geometry
CPPFLAGS += -I ${LARCOREOBJ_INC}
CPPFLAGS += -I ${NUSIMDATA_INC}
LIBS     += -L ${NUSIMDATA_LIB} -l nusimdata_SimulationBase
CPPFLAGS += -I ${CETLIB_INC}          -I ${CETLIB_EXCEPT_INC}
ifneq ($(origin CET_LIB_DIR), undefined)
LIBS     += -L ${CETLIB_LIB_DIR} -lcetlib -L ${CETLIB_EXCEPT_LIB} -lcetlib_except
endif
ifneq ($(origin CETLIB_LIB), undefined)
LIBS     += -L ${CETLIB_LIB} -lcetlib -L ${CETLIB_EXCEPT_LIB} -lcetlib_except
endif

CPPFLAGS += -I ${FHICLCPP_INC}
CPPFLAGS += -I ${UBOONEDAQ_DATATYPES_INC}
LIBS     += -L ${UBOONEDAQ_DATATYPES_LIB} -l ubdata_types
CPPFLAGS += -I ${ROOT_INC}

CPPFLAGS += -I ${SQLITE_INC}
LIBS     += -L ${SQLITE_LIB} -lsqlite3_ups

CPPFLAGS += -DGALLERY
# LIBS += -lgomp

ifneq ($(origin UBOBJ_INC), undefined)
  CPPFLAGS += -DSPLIT_UBOONECODE=1
  CPPFLAGS += -I  ${UBOBJ_INC}
  LIBS += -L${UBOBJ_LIB} 
else 
  # CPPFLAGS += -I ${UBOONECODE_INC}
  # LIBS     += -L ${UBOONECODE_LIB} -l uboone_RawData_utils_dict -l uboone_RawData
endif



## LARLITE is optional.
ifneq ($(origin LARLITE_DIR), undefined)
  CPPFLAGS += -DLARLITE=1
  CPPFLAGS += -I  ${LARLITE_COREDIR}
  LIBS += -L${LARLITE_LIBDIR} -lLArLite_DataFormat -lLArLite_Base
endif


CPPFLAGS += -I/usr/local/include  # for png.h



packages:
	@echo $(LIBS)
	@echo $(CPPFLAGS)
	# echo $(a)
	# echo ${nLIBS}
	# echo ${A} ${FOO}

# add any other desired libs here
# PNG
LIBS += -L/opt/X11/lib -lpng -lcrypto


# CPPFLAGS := $(filter-out -stdlib=libc++,$(CPPFLAGS))
LDFLAGS := $(filter-out -stdlib=libc++,$(LDFLAGS))
LIBS := $(filter-out -stdlib=libc++,$(LIBS))

#libcurl
LIBS += -lcurl


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


 
ifeq ($(UNAME),Darwin)
  libargo = libargo-backend.dylib
else
  libargo = libargo-backend.so
endif

argo-backend: $(OBJ) tmp/argo-backend.o Makefile
	$(CPP) $(LDFLAGS)  -L. $(OBJ)  tmp/argo-backend.o -W $(LIBS) -o $@ \
		-Wl,-rpath,@executable_path/../lib  \
		-Wl,-rpath,@executable_path \
    # -Wl,--unresolved-symbols=ignore-in-shared-libs


argo-backend-new: $(libargo) tmp/argo-backend.o Makefile
	$(CPP) $(LDFLAGS) $(filter %.o,$^) -L. -largo-backend  -W $(LIBS) -o $@ \
		-Wl,-rpath,@executable_path/../lib  \
		-Wl,-rpath,@executable_path
	# mkdir -p ../install/bin
	# cp argo-backend-new ../install/bin
  

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


libflags = 
ifeq ($(UNAME),Darwin)
  libflags = -install_name @rpath/libargo-backend.dylib
else
  libflags = -shared
endif

$(libargo): $(OBJ) tmp/Cint.o Makefile
	#$(CPP) -shared $(LDFLAGS) $(filter %.o,$^) -o $@  $(LIBS) $(BLIBS)
	$(CPP) $(LDFLAGS) $(filter %.o,$^) -o $@ $(LIBS) -dynamiclib $(libflags)

testbin: $(OBJ) tmp/argo-backend.o Makefile
	$(CPP) tmp/argo-backend.o $(LDFLAGS) -L. -largo-backend $(LIBS) $(BLIBS) -o $@


notify-live.cgi:  notify_live.cc
	/usr/bin/g++ $^ -o $@  
  

testx: $(OBJ) tmp/test-main.o tmp/Cint.o Makefile
	@echo "Building " $@ $(OBJ)
	$(CPP) $(LDFLAGS) $(filter %.o,$^) $(LIBS) -o $@


# This is a brute-force copy. This is now obsolete, since instead have these files committed to the argo repository.
# UBOONEDAQ_FILES =DaqFile.cpp Plexus.cpp Plexus_hardcoded.h  Client.cpp DispatcherMessage.cpp KvpSet.cpp Logging.cpp ConvertDispatcherToEventRecord.cpp #Timer.cpp
# UBOONEDAQ_FILES +=DaqFile.h Plexus.h  Client.h DispatcherMessage.h KvpSet.h Logging.h ConvertDispatcherToEventRecord.h #Timer.h
# copy: $(foreach f,$(UBOONEDAQ_FILES),$(wildcard $(uboonedaq)/*/$(f)))
#   cp $? .


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

