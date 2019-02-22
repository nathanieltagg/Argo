#include <TApplication.h>

#include "TROOT.h"
#include <iostream>

// Global, needs to exist one place in executable.
// TApplication app("MyApp", 0, 0);
#include "tkeyvfs.h"

// ensure it's executed:
struct global_init {
  global_init() {
      // ROOT::EnableThreadSafety ();  std::cout << "EnableThreadSafety initialized" << std::endl;      // This actually makes it FAIL big time!
      new TApplication("argo", 0, 0);      // ROOT::EnableImplicitMT(20);
      tkeyvfs_init();
  }
};

global_init _global_init;