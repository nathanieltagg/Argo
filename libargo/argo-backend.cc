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
#include "UniversalComposer.h"

#include "KvpSet.h"
#include "DeadChannelMap.h"

#include <signal.h>
#include <algorithm>
#include <string>

#include "json.hpp"


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
bool isChild = false;
int  childClient = -1;



int main(int argc, char **argv)
{
  int tcpPortNumber = 9092;
  bool forking_ = true;

  std::cout << gSystem << "  " << gSystem->GetBuildCompilerVersion() << std::endl;
  
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
  
  
  ROOT::EnableImplicitMT(20);
    // if(argc>1) {
    //   sscanf(argv[1],"%d",&tcpPortNumber);
    // }

  
  // termination handling.
  signal (SIGINT, TerminationHandler);
  signal (SIGHUP, TerminationHandler);
  signal (SIGTERM, TerminationHandler);
  signal ( SIGBUS, TerminationHandler);
  signal ( SIGSEGV, TerminationHandler);
  signal ( SIGILL, TerminationHandler);
  signal ( SIGFPE, TerminationHandler);
  signal (SIGCHLD, SIG_IGN);  // Ignore when a child dies - don't need to wait() or waitpid()
    
  try{

    cout << progname << " starting up at " <<  TTimeStamp().AsString() << " on port " << tcpPortNumber << endl;
    if(forking_) cout << "  Will fork on new clients." << endl;
    else         cout << "  Forking turned off for profiling." << endl;
    
    ss = new MySocketServer(tcpPortNumber);
    if(ss->Setup()) exit(1);  // Quit if socket won't bind.

    // write a PID file.
    {
      std::string pidfilename(progname);
      pidfilename = pidfilename.substr(pidfilename.find_last_of('/')+1);
      pidfilename+=".pid";
      cout << "Writing PID file to " << pidfilename << std::endl;
      ofstream pidfile(pidfilename.c_str());
      pidfile << gSystem->GetPid();
      pidfile.close();
    }
    
    Config_t configuration(new ntagg::json);
    (*configuration)["CacheStoragePath"] = "../datacache";
    (*configuration)["CacheStorageUrl"]  = "datacache";
    (*configuration)["plexus"] = { {"tpc_source", "sqlite ../db/current-plexus.db"}
                                 , {"pmt_source", "sqlite ../db/current-plexus.db"}
                                 };
    
    // ComposerFactory factory;
    // factory.configure(configuration);

    // gTimeStart = gSystem->Now();

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
            if(forking_) { isChild=true; childClient = client; }
            long long unsigned int mypid = getpid();
            // pid=0 either means no forking, or we're the child process
            std::string logfilename = "argo_backend_" + std::to_string(mypid) + ".log";
            std::string errfilename = "argo_backend_" + std::to_string(mypid) + ".err";
            
            if(forking_) {
              std::cout << "Serving by child process: " << mypid << "  filename " << logfilename << std::endl;
              
              freopen(logfilename.c_str(),"w",stdout);
              freopen(errfilename.c_str(),"a",stderr);
              // dup2(fileno(stdout), fileno(stderr));
              // freopen(logfilename.c_str(),"w",stderr);
            }
            
            cout << "Request started." << endl;
            cout << "Environment: " << getenv("ROOTSYS") << endl;
            
            cout << "Request Parameters:" << endl;
            cout << "    Filename: --" << filename << "--" << endl;
            cout << "    Selection:--" << selection << "--" << endl;
            cout << "    From:     --" << entrystart << " to " << entryend << endl;
            cout << "    Options:  --" << options << endl;
            
            long t1 = gSystem->Now();
            // Now do your stuff.
            
            Request_t request(new ntagg::json);
            (*request)["options"] = options;
            (*request)["filename"] = filename;
            (*request)["selection"] = selection;
            (*request)["entrystart"] = entrystart;
            (*request)["entryend"] = entryend;
            UniversalComposer composer;
            composer.configure(configuration);

            Output_t payload = composer.satisfy_request(request);
  
            long t2 = gSystem->Now();
            // Send it out.
            ss->SendTo(client, (unsigned char*)payload->c_str(),  payload->length() );
            cout << "Request served." << endl;
            long t3 = gSystem->Now();
          
            ss->Close(client);
            long t4 = gSystem->Now();
            cout << "Time to compose: " << t2-t1 << "  Time to Serve: " << t3-t2 << " Total: " << t4-t1 << std::endl;
            if(forking_) _exit(0);
          }
          ss->Close(client); // Make sure we're not servicing the client in the main fork anymore.
          
          // ComposerFactory::events_served++;
        }

      }
    }
    delete ss;
  }
  catch(std::exception& e) {
    cout << "Exception: " << e.what() << endl;
    exit(2);
  }
  catch(...) {
    cout << "Exception!" << endl;
    exit(2);
  }
}

void TerminationHandler(int signal)
{
  cerr << "Received signal " << signal << ". Shutting down the server.\n";
  if(isChild) {
    cerr << "Closing client " << childClient << "\n";
    if(childClient>-1) {
      std::string errormsg("{\"error\":\"Backend crashed hard when reading this event. Maybe a bad input file?\"}\n");
      ss->SendTo(childClient, (unsigned char*)errormsg.c_str(), errormsg.length() );
      close(childClient);
    }
    _exit(1);
  } else {
    if(ss) delete ss;// Shut down the socket server cleanly.
    ss = 0;
    exit(1);
  }
}
