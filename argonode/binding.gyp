{
  "targets": [
    {
      "target_name": "addon",
      "sources": [
        "Factory.cc"
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
                "/Users/tagg/Argo/backend",
                "<!(echo $ROOTSYS)/include"
               ],
      "libraries": [
                "-L /Users/tagg/Argo/backend", "-largo-backend"
              ],
     "link_settings": {
        "libraries": [ "-Wl,-rpath,/Users/tagg/Argo/backend", "-largo-backend" ]
        }
    }
  ]
}
