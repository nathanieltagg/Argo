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
#include "dispatcher/Client.h"
#include "dispatcher/KvpSet.h"
#include "dispatcher/ConvertDispatcherToEventRecord.h"

#include <signal.h>


using namespace std;


void TerminationHandler(int signal);


int main(int argc, char **argv)
{
  
  // termination handling.
  signal (SIGINT, TerminationHandler);
  signal (SIGHUP, TerminationHandler);
  signal (SIGTERM, TerminationHandler);

  // Startup:
  // Connect to dispatcher.
  // FIXME: Make configurable.
  string disp_host = "localhost";
  string disp_port = "2013";
  std::cout << "Dispatcher host: " << disp_host << std::endl;
  std::cout << "Dispatcher port: " << disp_port << std::endl;

  Client client(false);
  
  client.connect(disp_host,disp_port); // fixme: don't hardwire
  double retry_wait = 5;      
  if(!client.is_good() ) {
    result.add("error","Could not connect to dispatcher");
    return result.str();
  }
  logInfo << "Connected";
  
  std::string request_str = "requestTime=0;requestStale=1;";
  logInfo << "Requesting. " << request_str;
  if(!client.send_request(request_str)) {
    result.add("error","Problem sending request");
    return result.str();
  }
  
  if(!client.is_good() ) {
    result.add("error","Problem with client");
    return result.str();
  }
  std::string metadata;
  std::shared_ptr<DispatcherMessage> data;

  if(!client.wait_for_reply(metadata,data)) {
    result.add("error","Problem on retrieving reply");
    return result.str();
  }
  KvpSet md(metadata);
  result.add("dispatcher_header",KvpToJson(md));
  logInfo << "Got reply: payload: " << data->payload_size() << " bytes, metadata: "
    << " requestId="<< md.get("requestId")
    << " requestHeaderOnly="<< md.get("requestHeaderOnly")
    << " evMyEventNumber=" << md.get("evMyEventNumber")
      ;
  
  try {
   record = ConvertDispatcherToEventRecord(data.get());
   RawRecordComposer composer(result,record,inOptions);
   composer.compose();
  }
  catch(...) {
    cout << "Error: could not unpack event record");
  }


}

void TerminationHandler(int signal)
{
  cout << "Kill signal. Shutting down the server.\n";
  if(ss) delete ss; // Shut down the socket server cleanly.
  ss=0;
  exit(0);
}
