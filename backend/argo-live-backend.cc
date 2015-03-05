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
#include "RawRecordComposer.h"
#include "Timer.h"
#include "dispatcher/Client.h"
#include "dispatcher/KvpSet.h"
#include "dispatcher/ConvertDispatcherToEventRecord.h"

#include <signal.h>
#include <glob.h>

using namespace std; 
using namespace gov::fnal::uboone::dispatcher;
using gov::fnal::uboone::datatypes::eventRecord;

using namespace std;

// Configuration globals.
string oDispHost;
string oDispPort;    
string oOptions;      
string oCacheDir;     
string oCacheUrl;     
double oPeriod;       
int    oMaxFiles;     
JsonObject oConfigJson;

JsonObject KvpToJson(KvpSet& kvp)
{
  JsonObject j;
  for(int i=0;i<kvp.n();i++) {
    j.add(kvp.getKey(i), kvp.getVal(i));
  }
  return j;
}


void TerminationHandler(int signal);



void CleanCacheDirectory(std::string dir, int max)
{
  std::string globstr = dir + "/*.event";
  glob_t g;
  int r = glob(globstr.c_str(),0, NULL, &g);
  if(r) {
    logError << "Can't glob";
    return;
  }
  int n = g.gl_matchc;
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


void SaveHeartbeat(JsonObject& heartbeatInfo,const std::string& error = "")
{
  if(error.length()>0) heartbeatInfo.add("error",error);
  std::string filename=oCacheDir + "/heartbeat.json";
  ofstream heartbeatfile(filename);
  JsonElement::SetPrettyPrint(true);
  heartbeatfile << heartbeatInfo.str();
  JsonElement::SetPrettyPrint(false);
  heartbeatfile.close();
  logInfo << "Saved heartbeat";
}



int main(int argc, char **argv)
{
  
  // termination handling.
  signal (SIGINT, TerminationHandler);
  signal (SIGHUP, TerminationHandler);
  signal (SIGTERM, TerminationHandler);

  // Startup:
  
  // Load configuration from config file.
  std::string configfilename = "live.config";
  if(argc>1) configfilename = argv[1];
  ifstream configfile(configfilename);
  std::string configstr;
  while(configfile) {
    std::string line;
    std::getline(configfile,line);
    std::cout << line << "--" << std::endl;
    size_t found = line.find_first_of("#");
    if (found != string::npos) {
      std::cout << "found hash " << found << endl;
     	line.erase(found);
    }
    std::cout << line << "--" << std::endl;
    
    configstr += line;
  }
  configfile.close();
  KvpSet config(configstr);
  
  // Connect to dispatcher.
  // FIXME: Make configurable.
  oDispHost      = config.getString("dispatcherHost","localhost");
  oDispPort      = config.getString("dispatcherPort","2013");
  oOptions       = config.getString("options","");
  oCacheDir      = config.getString("cacheDir","../live_event_cache");
  oCacheUrl      = config.getString("cacheUrl","live_event_cache");
  oPeriod        = config.getDouble("period",10.0);
  oMaxFiles      = config.getInt   ("maxFiles",30);
  oConfigJson = KvpToJson(config);

  
  Client client(false);
  client.connect(oDispHost,oDispPort); 
  Timer retryTimer(0); // Zero means time is up.

  // Main loop.
  while(true) {
    
    JsonObject heartbeatInfo;
    heartbeatInfo.add("config",oConfigJson);
    
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
  
    std::string request_str = "requestTime=0;requestStale=1;";
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
    JsonObject mdj = KvpToJson(md);

    JsonObject result;
    result.add("dispatcher_header",mdj);
    heartbeatInfo.add("dispatcher_header",mdj);
    logInfo << "Got reply: payload: " << data->payload_size() << " bytes, metadata: "
      << " requestId="<< md.get("requestId")
      << " requestHeaderOnly="<< md.get("requestHeaderOnly")
      << " evMyEventNumber=" << md.get("evMyEventNumber")
        ;
  
    std::shared_ptr<gov::fnal::uboone::datatypes::eventRecord> record;
    try {
     record = ConvertDispatcherToEventRecord(data.get());
    }
    catch(...) {
       logInfo << "Error: could not unpack event record";
       SaveHeartbeat(heartbeatInfo, "Problem unpacking data from dispatcher.");
       continue;
     }
    
    
    RawRecordComposer composer(result,record,oOptions);
    try {
       composer.fCacheStoragePath     = oCacheDir;
       composer.fCacheStorageUrl      = oCacheUrl;

       composer.compose();
       std::string filename = composer.fCurrentEventDirname + "/" + "event.json";
       ofstream json(filename,std::ios_base::trunc);
       json << composer.fOutput;
       json.close();
       // atomic rename from working area to final area.
       std::string finalDirName = composer.fCurrentEventDirname;
       size_t pos = finalDirName.find(".working",0);
       if(pos != std::string::npos) finalDirName.replace(pos,8,".event");
       rename(composer.fCurrentEventDirname.c_str(),finalDirName.c_str());
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
    
    heartbeatInfo.add("success",1);
    heartbeatInfo.add("timeToProcess",timeToProcess.Count());
    SaveHeartbeat(heartbeatInfo);
     
  } // End main loop
  
}

void TerminationHandler(int signal)
{
  cout << "Kill signal. Shutting down the server.\n";
  exit(0);
}
