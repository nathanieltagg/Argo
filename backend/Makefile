
UNAME := $(shell uname -s)
.PHONY: all
all: depend bin

buildtargets = gtest libargo-backend.dylib argo-backend argo-live-backend argo-run-one notify-live.cgi
.PHONY: bin
bin: $(buildtargets)
#bin: gtest

clean:
	rm -rf tmp/*

#IGNORE := $(shell bash -c "source root/bin/thisroot.sh; env | sed 's/=/:=/' | sed 's/^/export /' > makeenv") 
#include makeenv 

pwd := $(shell pwd)

CPP := g++
LD := $(CPP)
shlibsuffix=so
LDFLAGS = -g 


ifeq ($(UNAME),Darwin)
  CPP = clang++ -O0
  # -gdwarf-4 -std=c++98 -std=c++17 -isysroot /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.12.sdk 
  # LD = clang++ -std=c++1y
  # CPPFLAGS += -fPIC -g
  LDFLAGS =  -g
  CPPFLAGS += -I /usr/local/opt/openssl/include
else 
  CPPFLAGS += -fPIC
  LDFLAGS += -lgomp -fPIC 
endif

# all library sources are cpp files.
SOURCES = $(notdir $(wildcard *.cpp)) 

# object files and dependency files
OBJ =  $(addprefix tmp/, $(patsubst %.cpp,%.o,$(SOURCES)) ) 
DEPS = $(patsubst %.o,%.d,$(wildcard tmp/*.o))

# Don't use the default FCL and messagelogger.
CPPFLAGS += -D NO_MSGLOG=1 -D NO_FCL=1

# abortive attempt:
#
# define myaddpkg =
# echo $(1)
# ifneq ($(origin $(1)_LIB), undefined)
# LIBS += -L $${$(1)_LIB}
# LIBS += $2
# endif
# ifneq ($(origin $(1)_INC), undefined)
# cadd = -I $${$(1)_INC}
# CPPFLAGS += -I $${$(1)_INC}
# endif
# endef
#
# $(eval $(call myaddpkg, BOOST, -lboost_serialization -lboost_system -lboost_thread -lboost_program_options))

# ldpaths=

#ROOT Special:
LIBS  += $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --libs )  -lTreePlayer -lTreeViewer
LDFLAGS += $(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --ldflags)
# ldpaths += -Wl,-rpath,$(shell ROOTSYS=${ROOTSYS} ${ROOTSYS}/bin/root-config --libdir)
CPPFLAGS += -I ${ROOT_INC}

#nonstandard:
CPPFLAGS += -I ${POSTGRESQL_INC}
LIBS     += -L ${POSTGRESQL_LIBRARIES} -lpq
# ldpaths  += -Wl,-rpath,${POSTGRESQL_LIBRARIES}

### Products added via ups
CPPFLAGS += -I ${BOOST_INC}
LIBS     += -L ${BOOST_LIB}  -lboost_serialization -lboost_system -lboost_thread -lboost_program_options
# ldpaths  += -Wl,-rpath,${BOOST_LIB}

CPPFLAGS += -I ${HEP_CONCURRENCY_INC}
LIBS     += -L ${HEP_CONCURRENCY_LIB} -l hep_concurrency
# ldpaths  += -Wl,-rpath,${HEP_CONCURRENCY_LIB}

CPPFLAGS += -I ${CANVAS_ROOT_IO_INC}
LIBS     += -L ${CANVAS_ROOT_IO_LIB} -l canvas_root_io
# ldpaths  += -Wl,-rpath,${CANVAS_ROOT_IO_LIB}

CPPFLAGS += -I ${GALLERY_INC}
LIBS     += -L ${GALLERY_LIB} -l gallery
# ldpaths  += -Wl,-rpath,${GALLERY_LIB}

CPPFLAGS += -I ${CANVAS_INC}
LIBS     += -L ${CANVAS_LIB} -l canvas
# ldpaths  += -Wl,-rpath,${CANVAS_LIB}

CPPFLAGS += -I ${LARDATAOBJ_INC}
LIBS     += -L ${LARDATAOBJ_LIB} -l lardataobj_RecoBase -l lardataobj_Simulation -l lardataobj_AnalysisBase
# ldpaths  += -Wl,-rpath,${LARDATAOBJ_LIB}

CPPFLAGS += -I ${LARCOREALG_INC}
LIBS     += -L ${LARCOREALG_LIB} -l larcorealg_Geometry
# ldpaths  += -Wl,-rpath,${LARCOREALG_LIB}

CPPFLAGS += -I ${LARCOREOBJ_INC} 

CPPFLAGS += -I ${NUSIMDATA_INC}
LIBS     += -L ${NUSIMDATA_LIB} -l nusimdata_SimulationBase
# ldpaths  += -Wl,-rpath,${NUSIMDATA_LIB}

CPPFLAGS += -I ${CETLIB_INC}  -I ${CETLIB_EXCEPT_INC}

ifneq ($(origin CET_LIB_DIR), undefined)
LIBS     += -L ${CETLIB_LIB_DIR} -lcetlib -L ${CETLIB_EXCEPT_LIB} -lcetlib_except
# ldpaths  += -Wl,-rpath,${CETLIB_LIB_DIR} -Wl,-rpath,${CETLIB_EXCEPT_LIB}
endif
ifneq ($(origin CETLIB_LIB), undefined)
LIBS     += -L ${CETLIB_LIB} -lcetlib -L ${CETLIB_EXCEPT_LIB} -lcetlib_except
# ldpaths  += -Wl,-rpath,${CETLIB_LIB} -Wl,-rpath,${CETLIB_EXCEPT_LIB}
endif

CPPFLAGS += -I ${FHICLCPP_INC}
CPPFLAGS += -I ${UBOONEDAQ_DATATYPES_INC}
LIBS     += -L ${UBOONEDAQ_DATATYPES_LIB} -l ubdata_types
# ldpaths  += -Wl,-rpath,${UBOONEDAQ_DATATYPES_LIB}

CPPFLAGS += -I ${ROOT_INC}

CPPFLAGS += -I ${SQLITE_INC}
LIBS     += -L ${SQLITE_LIB} -lsqlite3_ups
# ldpaths  += -Wl,-rpath,${SQLITE_LIB}


CPPFLAGS += -DGALLERY

## LARLITE is optional.
ifneq ($(origin LARLITE_DIR), undefined)
  CPPFLAGS += -DLARLITE=1
  CPPFLAGS += -I  ${LARLITE_COREDIR}
  LIBS += -L${LARLITE_LIBDIR} -lLArLite_DataFormat -lLArLite_Base
  # ldpaths  += -Wl,-rpath,${LARLITE_LIBDIR}
endif

CPPFLAGS += -I/usr/local/include  # for png.h

packages:
	@echo LIBS:
	@echo $(LIBS)
	@echo CPPFLAGS:
	@echo $(CPPFLAGS)

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
	@$(CPP) $(CPPFLAGS) -o $@ -c $<

tmp/%.o : %.cc
	@mkdir -p tmp
	@echo "compiling $@ $<"
	@$(CPP) $(CPPFLAGS) -o $@ -c $<


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
	@echo Building executable $@
	@$(CPP) $(LDFLAGS)  -L. $(OBJ)  tmp/argo-backend.o -W $(LIBS) -o $@ \
		-Wl,-rpath,@executable_path/../lib  \
		-Wl,-rpath,@executable_path \
    # -Wl,--unresolved-symbols=ignore-in-shared-libs

gtest: $(OBJ) tmp/gtest.o Makefile
	@echo Building executable $@
	@$(CPP) $(LDFLAGS)  -L. $(OBJ)  tmp/gtest.o -W $(LIBS) -o $@ \
		-Wl,-rpath,@executable_path/../lib  \
		-Wl,-rpath,@executable_path \
    # -Wl,--unresolved-symbols=ignore-in-shared-libs


# Using the $(ldpaths) variable doesn't actually do the job, 
# because the libraries are dependent on other libraries, so runtime can't find them unless the environment is set up.
# There are various solutions here:
# - Copy all the dependent libraries into one place (../lib or install/lib) and then use LD_LIBRARY_PATH on that one place
#   - Works well on linux, see linux-copy-libraries.sh
# - Do in-situ rpath adds to all libraries. This is invasive and probably stupid.
# - Copy all the dependent libraries into ../lib and change all rpaths to look in the same spot
#   - This doesn't work on linux, since chrpath and patchelf don't seem to be in the standard FermiLinux distros
#   - CAN work with mac os X using install_name_tool
#
# HOWEVER: none of that is useful because ROOT still needs to see the source code paths in order to build it's run-time object constructors
# In needs access to the compiler and to all the bits of code under
# I NEED to have the full UPS chain set up. Grr.

argo-backend-new: $(libargo) tmp/argo-backend.o Makefile
	$(CPP) $(LDFLAGS) $(filter %.o,$^) -L. -largo-backend  -W $(LIBS) -o $@ \
		-Wl,-rpath,@executable_path/../lib  \
		-Wl,-rpath,@executable_path \
		-Wl,-rpath,$$ORIGIN \
    # -Wl,-rpath,$$ORIGIN/../lib \
		#$(ldpaths)
	# mkdir -p ../install/bin
	# cp argo-backend-new ../install/bin
  


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
  # $(ldpaths)



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



depend: $(DEPS)

printenv: 
	@echo " CPPFLAGS = $(CPPFLAGS) "
	@echo " LIBS = $(LIBS)"
	@echo " Sources: $(SOURCES)"
	@echo " Objects: $(OBJ)"
	@echo " RHEADERS = $(RHEADERS)"
	
		

