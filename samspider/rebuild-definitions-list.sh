#!/bin/bash

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  TARGET="$(readlink "$SOURCE")"
  if [[ $TARGET == /* ]]; then
    echo "SOURCE '$SOURCE' is an absolute symlink to '$TARGET'"
    SOURCE="$TARGET"
  else
    DIR="$( dirname "$SOURCE" )"
    echo "SOURCE '$SOURCE' is a relative symlink to '$TARGET' (relative to '$DIR')"
    SOURCE="$DIR/$TARGET" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
  fi
done
echo "SOURCE is '$SOURCE'"
RDIR="$( dirname "$SOURCE" )"
DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
if [ "$DIR" != "$RDIR" ]; then
  echo "DIR '$RDIR' resolves to '$DIR'"
fi
echo "DIR is '$DIR'"

source /grid/fermiapp/products/uboone/setup_uboone.sh
setup sam_web_client
cd $DIR
samweb list-definitions > defs.txt
# remove all definitions with hash-codes like uboonepro_dd8becd2-fa73-4202-92d3-efbf508c04f5
# This is the vast majority of lines.
sed -i '/[a-z0-9]\{8\}-[a-z0-9]\{4\}-[a-z0-9]\{4\}-[a-z0-9]\{4\}-[a-z0-9]\{12\}/d'

#remove all definitions with 000123 run numbers - they aren't useful
# This removes another large chunk
sed -i '/[[:digit:]]\{6\}/d' ./defs.txt

# while read -r line || [[ -n "$line" ]]; do
#   samfiles=`samweb count-definition-files $line`
#   echo "def: $line  files: $samfiles"
# done < defs.txt

LC_ALL=C sort -T /localdata/temp/ defs.txt > defs_sorted.txt
