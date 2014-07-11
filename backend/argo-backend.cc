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
#include "ResultComposer.h"

#include <signal.h>
#include <algorithm>
#include <string>

// Quick and dirty option parsing, from StackOverflow.
char* getCmdOption(char ** begin, char ** end, const std::string & option)
{
    char ** itr = std::find(begin, end, option);
    if (itr != end && ++itr != end) return *itr;
    return 0;
}

bool cmdOptionExists(char** begin, char** end, const std::string& option)
{
    return std::find(begin, end, option) != end;
}


using namespace std;

VoidFuncPtr_t initfuncs[] = { 0 };
TROOT root("Rint", "The ROOT Interactive Interface", initfuncs);
void MyErrorHandler(int level, Bool_t abort, const char *location, const char *msg);
void TerminationHandler(int signal);



class MySocketServer : public SocketServer{
public:
  MySocketServer( int port ) : SocketServer(port) {};
  virtual ~MySocketServer() {};
  
  size_t SufficientData( const unsigned char* inData, size_t inSize, size_t inMaxSize) 
  { 
    static char options[100];
    static char filename[990];
    static char selection[990];
    Long64_t entrystart;
    Long64_t entryend;
    int bytes;
    int r =  sscanf((char*)inData,"%99[^,\n],%900[^,\n],%900[^,\n],%lld,%lld\n%n",options,filename,selection,&entrystart,&entryend,&bytes);
    if(r==5) return bytes;
    return 0;
  };
};


MySocketServer* ss = 0;


int main(int argc, char **argv)
{
  int tcpPortNumber = 9092;
  bool forking_ = true;

  std::string progname = argv[0];
  
  if(cmdOptionExists(argv, argv+argc, "-h")) {
    cout << "Usage:" <<endl;
    cout << "  -h         help" << endl;
    cout << "  -p <port>  set listener port " << endl;
    cout << "  -n         no forking (for profiling) " << endl;
    return 0;
  }
  if(cmdOptionExists(argv, argv+argc, "-n")) {
    forking_ = false;
  }

  char * filename = getCmdOption(argv, argv + argc, "-p");
  if (filename) sscanf(filename,"%d",&tcpPortNumber);
  
  
  
    // if(argc>1) {
    //   sscanf(argv[1],"%d",&tcpPortNumber);
    // }

  
  // termination handling.
  signal (SIGINT, TerminationHandler);
  signal (SIGHUP, TerminationHandler);
  signal (SIGTERM, TerminationHandler);
  signal (SIGCHLD, SIG_IGN);  // Ignore when a child dies - don't need to wait() or waitpid()
    
  try{

    cout << progname << " starting up at " <<  TTimeStamp().AsString() << " on port " << tcpPortNumber << endl;
    if(forking_) cout << "  Will fork on new clients." << endl;
    else         cout << "  Forking turned off for profiling." << endl;
    SetErrorHandler(MyErrorHandler);

    ss = new MySocketServer(tcpPortNumber);
    if(ss->Setup()) exit(1);  // Quit if socket won't bind.

    // write a PID file.
    {
      std::string pidfilename(argv[0]);
      pidfilename+=".pid";
      ofstream pidfile(pidfilename.c_str());
      pidfile << gSystem->GetPid();
      pidfile.close();
    }

    gTimeStart = gSystem->Now();

    while (1) {
      //cout << ".";
      //cout.flush();
      ss->CheckForBadClients();
    
      unsigned char* dataRecvd;
      int   client;
      bool  newClient;
      ss->Listen(100., // seconds timeout
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
        char selection[990];
        Long64_t entrystart;
        Long64_t entryend;
        int r =  sscanf((char*)dataRecvd,"%99[^,\n],%900[^,\n],%900[^,\n],%lld,%lld\n",options,filename,selection,&entrystart,&entryend);
        if(r==5) {
          //Successful conversion. Give it a try.
          cout << "Got a valid request at " << TTimeStamp().AsString() << endl;          
          // fork a process to cope.
          pid_t pid = 0;
          if(forking_) pid = fork();          
          if(pid ==0) {
            long long unsigned int mypid = getpid();
            // pid=0 either means no forking, or we're the child process
            std::string logfilename = "serve_log_" + std::to_string(mypid) + ".log";
            if(forking_) {
              std::cout << "Serving by child process: " << mypid << "  filename " << logfilename << std::endl;
              
              freopen(logfilename.c_str(),"w",stdout);
              freopen(logfilename.c_str(),"w",stderr);
            }
            
            cout << "Request Parameters:" << endl;
            cout << "    Filename: --" << filename << "--" << endl;
            cout << "    Selection:--" << selection << "--" << endl;
            cout << "    From:     --" << entrystart << " to " << entryend << endl;
            cout << "    Options:  --" << options << endl;
            
            long t1 = gSystem->Now();
            // Now do your stuff.
            ResultComposer rc;           // rc gets destroyed only after the client connection has been closed, which saves a little time (20%)
            std::string xml = rc.compose(options,filename,selection,entrystart,entryend);
            xml.append("\n");
            long t2 = gSystem->Now();
            // Send it out.
            ss->SendTo(client, (unsigned char*)xml.c_str(),  xml.length() );
            cout << "Request served." << endl;
            long t3 = gSystem->Now();
          
            ss->Close(client);
            long t4 = gSystem->Now();
            cout << "Time to compose: " << t2-t1 << "  Time to Serve: " << t3-t2 << " Total: " << t4-t1 << std::endl;
            if(forking_) _exit(0);
          }
          ss->RemoveClient(client); // Make sure we're not servicing the client in the main fork anymore.
          
          ResultComposer::events_served++;
        }

      }
    }
    delete ss;
  }
  catch(...) {
    cout << "Exception!" << endl;
    exit(2);
  }
}

void TerminationHandler(int signal)
{
  cout << "Kill signal. Shutting down the server.\n";
  if(ss) delete ss; // Shut down the socket server cleanly.
  ss = 0;
  exit(0);
}

void MyErrorHandler(int level, Bool_t abort, const char *location, const char *msg)
{
  // Suppress warning messages about branch sets.
  TString m(msg);
  if(m.BeginsWith("unknown branch")) return;
  
  DefaultErrorHandler(level, abort, location, msg);
//  exit(1);
}
