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
#include "UbdaqComposer.h"
#include "Timer.h"
#include "Client.h"
#include "KvpSet.h"
#include "ConvertDispatcherToEventRecord.h"
#include "TTimeStamp.h"

#include <signal.h>
#include <glob.h>
#include "json.hpp"

using namespace std; 
using namespace gov::fnal::uboone::dispatcher;
using gov::fnal::uboone::datatypes::ub_EventRecord;

using namespace std;
using nlohmann::json;

// Configuration globals.
string oDispHost;
string oDispPort;    
string oOptions;      
string oCacheDir;     
string oCacheUrl;     
double oPeriod;       
int    oMaxFiles;     
json oConfigJson;



void TerminationHandler(int signal);

json KvpToJson(KvpSet& kvp)
{
  json j;
  for(int i=0;i<kvp.n();i++) {
    j[kvp.getKey(i)] = kvp.getVal(i);
  }
  return j;
}


void CleanCacheDirectory(std::string dir, int max)
{
  std::string globstr = dir + "/*.event";
  glob_t g;
  int r = glob(globstr.c_str(),0, NULL, &g);
  if(r) {
    // logError << "Can't glob";
    return;
  }
  int n = g.gl_pathc;
  std::vector<std::string> events;
  for(int i=0;i<n;i++) if(g.gl_pathv[i]) events.push_back(g.gl_pathv[i]);
  // for(int i=0;i<events.size();i++) cout << events[i] << endl;
  // These should already be sorted. Nuke some of them. 
  while(events.size()>max) {
    std::string todelete = events[0];
    logInfo << "Deleting " << todelete;
    events.erase(events.begin());
    std::string cmd = "rm -rf ";
    cmd += todelete;
    system(cmd.c_str());
  }
  globfree(&g);
}


void SaveHeartbeat(json heartbeatInfo,const std::string& error = "")
{
  if(error.length()>0) heartbeatInfo["error"]=error;
  std::string filename=oCacheDir + "/heartbeat.json";
  ofstream heartbeatfile(filename);
  heartbeatfile << heartbeatInfo.dump(2) << std::endl;
  heartbeatfile.close();
  logInfo << "Saved heartbeat";
}



int main(int argc, char **argv)
{
  
  // termination handling.
  signal (SIGINT, TerminationHandler);
  signal (SIGHUP, TerminationHandler);
  signal (SIGTERM, TerminationHandler);

  
  // write a PID file.
  std::string progname = argv[0];
  {
      std::string pidfilename(progname);
      pidfilename+=".pid";
      ofstream pidfile(pidfilename.c_str());
      pidfile << getpid();
      pidfile.close();
      std::cout << "Writing PID file " << pidfilename << " " <<getpid() << std::endl;
  }
  
  // Load configuration from config file.
  std::string configfilename = "live.config.json";
  if(argc>1) configfilename = argv[1];

  std::cout << "Loading config file " << configfilename << std::endl;
  ifstream configfile(configfilename);
  json config;
  configfile >> config;
  configfile.close();
  std::cout << "----Configuration:----" << std::endl;
  std::cout << config.dump(2) << std::endl;
  
  
  // Connect to dispatcher.
  // FIXME: Make configurable.
  oDispHost      = config.value("dispatcherHost","localhost");
  oDispPort      = std::to_string(config.value("dispatcherPort",2013));
  oOptions       = config.value("options","");
  oCacheDir      = config.value("cacheDir","../live_event_cache");
  oCacheUrl      = config.value("cacheUrl","live_event_cache");
  oPeriod        = config.value("period",5.0);
  oMaxFiles      = config.value("maxFiles",30);
  oConfigJson = config;

  json heartbeat_init;
  heartbeat_init["config"]=oConfigJson;
  heartbeat_init["starting"]=1;
  SaveHeartbeat(heartbeat_init);
  
  Client client(false);
  client.connect(oDispHost,oDispPort); 
  Timer retryTimer(0); // Zero means time is up.

  UbdaqComposer composer;
  composer.configure(std::shared_ptr<json>(new json(config)));


  // Main loop.
  while(true) {
    
    json heartbeatInfo;
    heartbeatInfo["config"]=oConfigJson;
    
    
    // Check for too many files. Delete as required
    CleanCacheDirectory(oCacheDir,oMaxFiles);
    retryTimer.Camp(oPeriod);
    retryTimer.Reset();

    Timer timeToProcess;
    if(!client.is_good() ) {
      logInfo << "Attempt to connect...";      
      client.connect(oDispHost,oDispPort); 
    }
    if(!client.is_good() ) {
      logInfo << "Connection to dispatcher failed.";
      SaveHeartbeat(heartbeatInfo, "Connection to dispatcher failed.");
      continue;
    }
    logInfo << "Connected";
  
    std::string request_str = "requestTime=0;requestStale=0;";
    logInfo << "Requesting. " << request_str;
    if(!client.send_request(request_str)) {
      logInfo << "Can't send request.";
      SaveHeartbeat(heartbeatInfo, "Failed to send request to dispatcher.");
      continue;
    }
  
    if(!client.is_good() ) {
      logInfo << "Problem with client after request send.";
      SaveHeartbeat(heartbeatInfo, "Problem with dispatcher connection after request send.");
      continue;
    }

    std::string metadata;
    std::shared_ptr<DispatcherMessage> data;
    if(!client.wait_for_reply(metadata,data)) {
      logInfo << "Problem on retrieving reply";
      SaveHeartbeat(heartbeatInfo, "Problem with recieving reply from dispatcher");
      continue;
    }
    KvpSet md(metadata);
    json mdj = KvpToJson(md);

    Result_t result(new json);
    json source;
    source["dispatcher"]=mdj;
    (*result)["source"]=source;

    heartbeatInfo["dispatcher"]=mdj;
    logInfo << "Got reply: payload: " << data->payload_size() << " bytes, metadata: "
      << " requestId="<< md.get("requestId")
      << " requestHeaderOnly="<< md.get("requestHeaderOnly")
      << " evMyEventNumber=" << md.get("evMyEventNumber")
        ;
  
    std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record;
    try {
     record = ConvertDispatcherToEventRecord(data.get());
    }
    catch(...) {
       logInfo << "Error: could not unpack event record";
       SaveHeartbeat(heartbeatInfo, "Problems unpacking data from dispatcher.");
       //continue;
    }
     
    if(!record) {
      logInfo << "Error: no record!"; 
      SaveHeartbeat(heartbeatInfo, "Dispatcher has no data.");
      continue;
    }    
    
    Request_t request(new json);
    (*request)["options"]=oOptions;
    try {
       composer.satisfy_request(request,result,record);
       
       std::string filename = composer.m_current_event_dir_name + "/" + "event.json";
       ofstream jsonfile(filename,std::ios_base::trunc);
       jsonfile << *result;
       jsonfile.close();
       // atomic rename from working area to final area.
       std::string finalDirName = composer.m_current_event_dir_name;
       size_t pos = finalDirName.find(".working",0);
       if(pos != std::string::npos) finalDirName.replace(pos,8,".event");
       rename(composer.m_current_event_dir_name.c_str(),finalDirName.c_str());
    }
    catch (const std::exception& error)
    {
      std::string s = "Error: could not compose JSON result: "; 
      s+=error.what();
      logInfo << s;
      SaveHeartbeat(heartbeatInfo, s);
      continue;
    }
    catch(...) {
        logInfo << "Error: could not compose JSON result";
        SaveHeartbeat(heartbeatInfo, "Could not compose JSON result");
        continue;
    }
    
    heartbeatInfo["success"]=1;
    heartbeatInfo["timeToProcess"]=timeToProcess.Count();
    SaveHeartbeat(heartbeatInfo);
     
  } // End main loop
  
}

void TerminationHandler(int signal)
{
  cout << "Kill signal. Shutting down the server.\n";
  exit(0);
}
