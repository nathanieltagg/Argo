#!/bin/bash

pushd `dirname "${BASH_SOURCE[0]}"` >> /dev/null;
SCRIPTPATH=`pwd`
popd >> /dev/null

#upsscript=$SCRIPTPATH/../ups/setup_for_development
#if [ -r $upsscript ] ; then source $upsscript -d; fi;
#source $SCRIPTPATH/../ups/setup_for_development
export LD_LIBRARY_PATH=$SCRIPTPATH/root/lib:$SCRIPTPATH/boost/lib
export DYLD_LIBRARY_PATH=${LD_LIBRARY_PATH}

source $SCRIPTPATH/root/bin/thisroot.sh


