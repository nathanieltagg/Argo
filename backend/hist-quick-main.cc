//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include <stdlib.h>
#include <stdio.h>
#include <iostream>
#include <fstream>

#include <TROOT.h>
#include <TRint.h>
#include <TStyle.h>
#include <TSystem.h>
#include <TTimeStamp.h>
#include <TError.h>

#include "SocketServer.h"
#include "JsonElement.h"

#include "ComposeResult.h"

TTime gTimeStart;


void MyErrorHandler(int level, Bool_t abort, const char *location, const char *msg)
{
  // Suppress warning messages about branch sets.
  TString m(msg);
  if(m.BeginsWith("unknown branch")) return;
  
  DefaultErrorHandler(level, abort, location, msg);
//  exit(1);
}


int main(int argc, char **argv)
{ 
  SetErrorHandler(MyErrorHandler);
  if(argc<3) return 0;
  std::string filename = argv[1];
  std::string histname = argv[2];
  std::string options;
  if(argc>3) options = argv[3];
    
  std::string str = ComposeResult(filename,histname,options);
  std::cout << str;
}
