{
  "targets": [
    {
      "target_name": "argo-backend-node",
      "sources": [ "argo-backend-node.cc" ],
      "include_dirs" : [
                "/Users/tagg/Argo/backend",
               ],
      "libraries": [
                "-L /Users/tagg/Argo/backend", "-largo-backend"
              ],
     'link_settings': {
        'libraries': [ "-L /Users/tagg/Argo/backend", "-largo-backend" ]
        }
    }
  ]
}