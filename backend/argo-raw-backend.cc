//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>
#include <iostream>
#include <fstream>

#include "SocketServer.h"
#include "RawResultComposer.h"
#include "Timer.h"

#include <signal.h>


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

int main(int argc, char **argv)
{
  
  // termination handling.
  signal (SIGINT, TerminationHandler);
  signal (SIGHUP, TerminationHandler);
  signal (SIGTERM, TerminationHandler);
    
  try{

    int tcpPortNumber = 9092;
    if(argc>1) {
      sscanf(argv[1],"%d",&tcpPortNumber);
    }
    cout << argv[0] << " starting up on port " << tcpPortNumber << endl;
  
    // SetErrorHandler(MyErrorHandler);

    ss = new MySocketServer(tcpPortNumber);
    if(ss->Setup()) exit(1);  // Quit if socket won't bind.

    // write a PID file.
    {
      std::string pidfilename(argv[0]);
      pidfilename+=".pid";
      ofstream pidfile(pidfilename.c_str());
      pidfile << getpid();
      pidfile.close();
    }

    gStartTimer.Reset();

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
          cout << "Got a valid request at " << Timer().AsString() << endl;
          cout << "    Filename: --" << filename << "--" << endl;
          cout << "    Selection:--" << selection << "--" << endl;
          cout << "    From:     --" << entrystart << " to " << entryend << endl;
          cout << "    Options:  --" << options << endl;

          // Now do your stuff.
          RawResultComposer rc;
          std::string xml = rc.compose(options,filename,selection,entrystart,entryend);
          // Send it out.
          ss->SendTo(client, (unsigned char*)xml.c_str(),  xml.length() );
          cout << "Request served." << endl;
          ss->Close(client);
          
          // rc gets destroyed only after the client connection has been closed, which saves a little time (20%)
        }

      }
    }
    delete ss;
  }
  catch(const std::exception& ex) {
	cout << "Exception: " << ex.what();
        exit(2);
  } catch (const std::string& ex) {
    cout << ex;
    exit(2);
  } catch(...){
    cout << "Exception!" << endl;
    exit(2);
  }
}

void TerminationHandler(int signal)
{
  cout << "Kill signal. Shutting down the server.\n";
  if(ss) delete ss; // Shut down the socket server cleanly.
  ss=0;
  exit(0);
}
