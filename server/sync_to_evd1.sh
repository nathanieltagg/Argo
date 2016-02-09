#!/bin/bash
# see http://stackoverflow.com/questions/20281243/atomic-rsync-at-directory-level-with-minimum-temporary-storage
# also https://blog.interlinked.org/tutorials/rsync_time_machine.html
export RSH=ssh
source="/datalocal/WebServices/Argo/live_event_cache/"
d=`date +%s`
target="/localdata/argo_live_event_cache/cache_$d/"
targetdiff="/localdata/argo_live_event_cache/current"

rsync --link-dest="$targetdiff" --archive "$source" "tagg@ubooneevd1.fnal.gov:$target" --exclude '*.working'
# Atomic move.
ssh tagg@ubooneevd1.fnal.gov "ln -sfn $target $targetdiff;"
# Delete old files.  Script on remote host, but run under this cron.
ssh tagg@ubooneevd1.fnal.gov "/localdata/argo_live_event_cache/delete_old.sh"

# contents of the delete_old.sh script:
# !/bin/bash
# rm -rf `ls -d cache_* | sort -n | head -n -2`
#
