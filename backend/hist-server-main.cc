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
#include "TFile.h"
#include "TH1.h"
#include "TH2.h"

#include "ComposeResult.h"

TTime gTimeStart;

using namespace std;

VoidFuncPtr_t initfuncs[] = { 0 };
TROOT root("Rint", "The ROOT Interactive Interface", initfuncs);
void MyErrorHandler(int level, Bool_t abort, const char *location, const char *msg);

class MySocketServer : public SocketServer{
public:
  MySocketServer( int port ) : SocketServer(port) {};
  virtual ~MySocketServer() {};
  
  size_t SufficientData( const unsigned char* inData, size_t inSize, size_t inMaxSize) 
  { 
    static char options[100];
    static char filename[990];
    static char histname[990];
    int bytes;
    int r =  sscanf((char*)inData,"%99[^,\n],%900[^,\n],%900[^,\n]\n%n",options,filename,histname,&bytes);
    if(r==3) return bytes;
    return 0;
  };
};

int main(int argc, char **argv)
{
  try{

  int tcpPortNumber = 8013;
  if(argc>1) {
    sscanf(argv[1],"%d",&tcpPortNumber);
  }
  cout << argv[0] << "starting up at " <<  TTimeStamp().AsString() << " on port " << tcpPortNumber << endl;
  
  SetErrorHandler(MyErrorHandler);

  MySocketServer ss(tcpPortNumber);
  if(ss.Setup()) exit(1);  // Quit if socket won't bind.

  // write a PID file.
  {
    std::string pidfilename = std::string( argv[0] ) + ".pid";
    ofstream pidfile(pidfilename.c_str());
    pidfile << gSystem->GetPid();
    pidfile.close();
  }

  gTimeStart = gSystem->Now();

  while (1) {
    //cout << ".";
    //cout.flush();
    ss.CheckForBadClients();
    
    unsigned char* dataRecvd;
    int   client;
    bool  newClient;
    ss.Listen(100., // seconds timeout
              1000, // bytes max
              dataRecvd, // data recieved in message
              client,    // fd number of client.
              newClient  // true if a new client connected.
              );
    if(newClient) {
      cout << "New client " << client << endl;
    }
    
    if(dataRecvd) {
      // Try to parse format of FILENAME,GATE\n
      char options[100];
      char filename[990];
      char histname[990];
      int r = sscanf((char*)dataRecvd,"%99[^,\n],%900[^,\n],%900[^,\r\n]",options,filename,histname);
      if(r==3) {
        //Successful conversion. Give it a try.
        cout << "Got a valid request at " << TTimeStamp().AsString() << endl;
        cout << "    Filename: --" << filename << "--" << endl;
        cout << "    Histname :--" << histname << "--" << endl;
        cout << "    Options:  --" << options << endl;

        std::string str = ComposeResult(filename,histname,options);
        // Send it out.
        ss.SendTo(client, (unsigned char*) str.c_str(),  str.length() );
        cout << "Request served." << endl;
        ss.Close(client);
      }

    }
  }
  }
  catch(...) {
    cout << "Exception!" << endl;
    exit(2);
  }
}


void MyErrorHandler(int level, Bool_t abort, const char *location, const char *msg)
{
  // Suppress warning messages about branch sets.
  TString m(msg);
  if(m.BeginsWith("unknown branch")) return;
  
  DefaultErrorHandler(level, abort, location, msg);
//  exit(1);
}
