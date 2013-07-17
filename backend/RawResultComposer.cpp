//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include "RawResultComposer.h"
#include "RawRecordComposer.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include "JsonElement.h"
#include "Timer.h"

#include "Client.h"
#include "KvpSet.h"
#include "Client.h"
#include "ConvertDispatcherToEventRecord.h"


using gov::fnal::uboone::datatypes::eventRecord;

Timer gStartTimer;
using namespace std; 

static UInt_t events_served = 0;

using namespace uboone::dispatcher;

JsonObject KvpToJson(KvpSet& kvp)
{
  JsonObject j;
  for(int i=0;i<kvp.n();i++) {
    j.add(kvp.getKey(i), kvp.getVal(i));
  }
  return j;
}

RawResultComposer::RawResultComposer()
{
  
}


string RawResultComposer::compose(
         const char* inOptions,
         const char* inPath,
         const char* inSelection,
         Long64_t inStart,
         Long64_t inEnd )
{
  events_served++;

  // Test code to see what serve_event.cgi will do if the process hangs on an event.
  // if(events_served>2)
  //   { while(true) {;} }

  Timer eventTimeStart;

  // Do whatever input option looks best.
  std::string path(inPath);
  
  std::shared_ptr<gov::fnal::uboone::datatypes::eventRecord> record;
  
  // If it is a dispatcher call:
  if(path.find("dispatcher",0)==0) {
    // Make a call to the dispatcher!
      Client client(false);

      client.connect("localhost","2013"); // fixme: don't hardwire
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
       record = ConvertDispatcherToEventRecord(data.get());
        
  } else {
    // Open an actual-to-goodness file.
    
  }
  
  logInfo << "Got a record and ready to compose.";
  if(record) {
    RawRecordComposer composer(result,record,inOptions);
    composer.compose();
  }
  // This is a good time to figure out the software version information.
  
  JsonObject source;
  source.add("file",inPath);
  source.add("selection",inSelection);
  source.add("start",inStart);
  source.add("end",inEnd);
  // source.add("entry",jentry);
  source.add("options",inOptions);
  // source.add("numEntriesInFile",nentries);
  result.add("source",source);

  JsonObject monitor;
  // monitor.add("pid",gSystem->GetPid());
 //  monitor.add("events_served",events_served);
 //  SysInfo_t sysinfo;  gSystem->GetSysInfo(&sysinfo);
 //  // CpuInfo_t cpuinfo;  gSystem->GetCpuInfo(&cpuinfo);
 //  MemInfo_t meminfo;  gSystem->GetMemInfo(&meminfo);
 //  ProcInfo_t procinfo; gSystem->GetProcInfo(&procinfo);
 //  
 //  monitor.add("OS"           , sysinfo.fOS.Data());
 //  monitor.add("ComputerModel", sysinfo.fModel.Data());
 //  monitor.add("CpuType"      ,  sysinfo.fCpuType.Data());
 //  monitor.add("Cpus"         ,  sysinfo.fCpus);
 //  monitor.add("CpuSpeed"     ,  sysinfo.fCpuSpeed);
 //  monitor.add("PhysicalRam"  ,  sysinfo.fPhysRam);
 // 
 //  monitor.add("MemTotal"     ,  Form("%d MB",meminfo.fMemTotal));
 //  monitor.add("MemUsed"      ,  Form("%d MB",meminfo.fMemUsed));
 //  monitor.add("MemFree"      ,  Form("%d MB",meminfo.fMemFree));
 //  monitor.add("SwapTotal"    ,  Form("%d MB",meminfo.fSwapTotal));
 //  monitor.add("SwapUsed"     ,  Form("%d MB",meminfo.fSwapUsed));
 //  monitor.add("SwapFree"     ,  Form("%d MB",meminfo.fSwapFree));
 // 
 //  monitor.add("CpuTimeUser"     ,  procinfo.fCpuUser);
 //  monitor.add("CpuTimeSys"     ,   procinfo.fCpuSys);
 //  monitor.add("MemResident"    ,   Form("%f MB",procinfo.fMemResident/1000.));
 //  monitor.add("MemVirtual"     ,   Form("%f MB",procinfo.fMemVirtual/1000.));
 // 
  monitor.add("WallClockTime"  ,   gStartTimer.Count()*1000);
  result.add("backend_monitor",monitor);

  // 
  // Get it.
  //


  // Here's where all the joy happens.
  // RawRecordComposer composer(result,tree,jentry,inOptions);
  // composer.compose();
  
  
  result.add("ElapsedServerTime",eventTimeStart.Count()*1000.);
  
  return result.str();
}

RawResultComposer::~RawResultComposer()
{
  // The reason for doing this here is that closing the file and garbage collection take ~20% of the time.
  // This lets the main routine deliver the result, then perform cleanup;
  
  // Always close the file - let's see if this stops memory leaks.
}



