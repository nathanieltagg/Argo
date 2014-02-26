# For use on ups systems, source this.
if [ -r /uboone/setup ] ; then
  source /uboone/setup
  setup gcc v4_7_1
  setup root v5_34_05 -q e2:debug
fi
