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
#include <sys/types.h>
#include <sys/wait.h>

#include "SocketServer.h"
#include "UbdaqComposer.h"
#include "Timer.h"
#include "Client.h"
#include "KvpSet.h"
#include "ConvertDispatcherToEventRecord.h"
#include "datatypes/raw_data_access.h"
#include "TTimeStamp.h"

#include <signal.h>
#include <glob.h>
#include "json.hpp"

#include <curl/curl.h>

// #include <filesystem>
// namespace fs = std::filesystem;

#include <boost/filesystem.hpp>
namespace fs = boost::filesystem;

using namespace std; 
using namespace gov::fnal::uboone::dispatcher;
using gov::fnal::uboone::datatypes::ub_EventRecord;

using namespace std;
using ntagg::json;

// Configuration globals.
string oDispHost;
string oDispPort;    
string oOptions;      
string oCacheDir;     
string oCacheUrl;     
double oPeriod;       
int    oMaxFiles;     
json oConfigJson;

std::vector< std::string > oHeartbeatNodes;
std::vector< std::string > oFullDataNodes;

json config;


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

  // Now delete all the 'working' directories; at this moment, there shouldn't be any.
  {
    std::string globstr = dir + "/*.working";
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
    while(events.size()>0) {
      std::string todelete = events[0];
      logInfo << "Deleting " << todelete;
      events.erase(events.begin());
      std::string cmd = "rm -rf ";
      cmd += todelete;
      system(cmd.c_str());
    }
    globfree(&g);
  }


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

void SendHeartbeatOne(const std::string& hosturl ,bool allfiles, const json& heartbeatInfo,const std::string& data_dir = "")
{
    std::string short_dir_name =  fs::path(data_dir+"/event.json").parent_path().filename().string();
    std::cout << "===>" << short_dir_name << std::endl;

    std::vector< std::string > args;
    args.push_back("-v");
    args.push_back("--globoff");
    args.push_back("--connect-timeout");
      args.push_back("0.3"); // 300 ms to connect to server.11
    // args.push_back("--output");
      // args.push_back(hosturl+".send.log");
    args.push_back("-F");
      args.push_back(std::string("heartbeat=").append(heartbeatInfo.dump()));
    if(data_dir.length()>0) {
      args.push_back("-F");
      args.push_back(std::string("event_dir=").append(short_dir_name)); // "r1e1.event"
      if(allfiles) {
        for(const auto& entry : fs::directory_iterator(data_dir)) {  // all files in /blah/live_event_cache/r1e1.event
            args.push_back("-F");
            std::string s = entry.path().filename().string();
            s += "=@";
            s += entry.path().string();
            args.push_back(s);
        }
      }
    }
    args.push_back(hosturl);
    std::cout << "Forking curl execv ";
    for(auto& s: args) cout << " " << s;
    std::cout << std::endl;

    // Convert to char** for ancient system call.
    std::vector<const char*> cargs{};
    for(const auto& s : args) cargs.push_back(s.c_str());
    cargs.push_back(NULL);

    if(fork() == 0) {
        std::cout << "Send to " << hosturl << " started" << std::endl;
        execv("/usr/bin/curl",(char**)(cargs.data())); // If child of fork, execute and replace process.
    }
     int status = 0;
     while (::wait(&status) > 0); // this way, the father waits for all the child processes

}

 

void SendHeartbeat(const json& heartbeatInfo,const std::string& data_dir = "")
{
  // File lists.
  for(auto hosturl: oHeartbeatNodes)  SendHeartbeatOne(hosturl,false,heartbeatInfo,data_dir);
  for(auto hosturl: oFullDataNodes)   SendHeartbeatOne(hosturl,true,heartbeatInfo,data_dir);

  int status = 0;
  while (::wait(&status) > 0); // this way, the father waits for all the child processes 
  std::cout << "All sends complete" << std::endl;
}


int main(int argc, char **argv)
{


  curl_global_init(CURL_GLOBAL_ALL);

  
  // termination handling.
  signal (SIGINT, TerminationHandler);
  signal (SIGHUP, TerminationHandler);
  signal (SIGTERM, TerminationHandler);
 // Startup:
  gov::fnal::uboone::datatypes::peek_at_next_event<ub_TPC_CardData_v6>(false);
  gov::fnal::uboone::datatypes::peek_at_next_event<ub_PMT_CardData_v6>(false);
  gov::fnal::uboone::datatypes::handle_missing_words<ub_TPC_CardData_v6>(true);
  gov::fnal::uboone::datatypes::handle_missing_words<ub_PMT_CardData_v6>(true);
 // explicitly unpack.
  pmt_crate_data_t::doDissect(true);
  tpc_crate_data_t::doDissect(true);
  trig_crate_data_t::doDissect(true);


  
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
  configfile >> config;
  configfile.close();
  std::cout << "----Configuration:----" << std::endl;
  std::cout << config.dump(2) << std::endl;
  
  
  // Connect to dispatcher.
  // FIXME: Make configurable.
  oDispHost      = config.value("dispatcherHost","localhost");
  oDispPort      = std::to_string(config.value("dispatcherPort",2013));
  oOptions       = config.value("options","");
  oCacheDir      = config.value("CacheStoragePath","../live_event_cache");
  oCacheUrl      = config.value("CacheStorageUrl","live_event_cache");
  oPeriod        = config.value("period",5.0);
  oMaxFiles      = config.value("maxFiles",30);
  oConfigJson = config;
  if(config["hearbeatNodes"].is_array())
    for(auto& element:config["hearbeatNodes"]) oHeartbeatNodes.push_back(element);
  if(config["fullDataNodes"].is_array())
    for(auto& element:config["fullDataNodes"]) oFullDataNodes.push_back(element);

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
    // heartbeatInfo["config"]=oConfigJson;
    
    
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
      SendHeartbeat(heartbeatInfo);

      continue;
    }
    logInfo << "Connected";
  
    std::string request_str = "requestTime=0;requestStale=0;";
    logInfo << "Requesting. " << request_str;
    if(!client.send_request(request_str)) {
      logInfo << "Can't send request.";
      SaveHeartbeat(heartbeatInfo, "Failed to send request to dispatcher.");
      SendHeartbeat(heartbeatInfo);
      continue;
    }
  
    if(!client.is_good() ) {
      logInfo << "Problem with client after request send.";
      SaveHeartbeat(heartbeatInfo, "Problem with dispatcher connection after request send.");
      SendHeartbeat(heartbeatInfo);
      continue;
    }

    std::string metadata;
    std::shared_ptr<DispatcherMessage> data;
    if(!client.wait_for_reply(metadata,data)) {
      logInfo << "Problem on retrieving reply";
      SaveHeartbeat(heartbeatInfo, "Problem with receiving reply from dispatcher");
      SendHeartbeat(heartbeatInfo);
      continue;
    }
    KvpSet md(metadata);
    json mdj = KvpToJson(md);

    json source;
    // source["dispatcher"]=mdj;
    // (*result)["source"]=source;

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
       SendHeartbeat(heartbeatInfo);
       //continue;
    }
     
    if(!record) {
      logInfo << "Error: no record!"; 
      SaveHeartbeat(heartbeatInfo, "Dispatcher has no data.");
      SendHeartbeat(heartbeatInfo);
      continue;
    }    
    

    Request_t request(new json(json::object()));

    std::string finalDirName ="";
    (*request)["options"]=oOptions;

    try {
       std::cout << "satisfy_request " << request->dump();
       Output_t payload = composer.satisfy_request(request,record);
       
       std::string filename = composer.m_current_event_dir_name + "/" + "event.json";
       std::cout << "Writing " << filename << std::endl;
       ofstream jsonfile(filename,std::ios_base::trunc);
       jsonfile << *payload;
       jsonfile.close();
       // atomic rename from working area to final area.
       finalDirName = composer.m_current_event_dir_name;
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
      SendHeartbeat(heartbeatInfo);
      continue;
    }
    catch(...) {
        logInfo << "Error: could not compose JSON result";
        SaveHeartbeat(heartbeatInfo, "Could not compose JSON result");
        SendHeartbeat(heartbeatInfo);
        continue;
    }
    
    heartbeatInfo["success"]=1;
    heartbeatInfo["timeToProcess"]=timeToProcess.Count();
    SaveHeartbeat(heartbeatInfo);
    SendHeartbeat(heartbeatInfo,finalDirName);
     
  } // End main loop
  
}

void TerminationHandler(int signal)
{
  cout << "Kill signal. Shutting down the server.\n";
  exit(0);
}
