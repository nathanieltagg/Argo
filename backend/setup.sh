# For use on ups systems, source this.
if [ -r /uboone/setup ] ; then
  source /uboone/setup
  setup git v1_7_5_4 -f Linux64bit+2.6-2.5 -q GCC_4_1_2
  unset GIT_DIR
  setup gcc v4_7_1
  setup root v5_34_05 -q e2:debug
fi
