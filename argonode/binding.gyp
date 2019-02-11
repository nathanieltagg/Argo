{
  "targets": [
    {
      "target_name": "addon",
      "sources": [
        "ComposerWrapper.cc"
      ],
      'cflags_cc!': [ '-fno-rtti' ],
      'conditions': [
        ['OS=="mac"', {
                  'xcode_settings': {
                    'GCC_ENABLE_CPP_RTTI': 'YES'
                  }
                }],
        ],
      
      "include_dirs" : [
                "<!(node -e \"require('nan')\")",
                "../libargo",
                "<!(echo $ROOTSYS)/include",
                "<!(echo $BOOST_INC)"
               ],
      "libraries": [
                "-L ../../libargo", "-largo-backend"
              ],
     "link_settings": {
        "libraries": [ "-Wl,-rpath,../../../libargo","-Wl,-rpath,libargo","-Wl,-rpath,../libargo", "-largo-backend" ]
        }
    }
  ]
}
