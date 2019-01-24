#include "ForkedComposer.h"


// global is declared ONLY on child fork
Composer* gForkedComposer = 0;

void ForkTerminationHandler(int signal)
{
  std::cout << "ForkTerminationHandler" << std::endl; 
  if (gForkedComposer) delete gForkedComposer;
  exit(0);
}

