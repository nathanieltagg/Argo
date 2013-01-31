//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include "make_xml.h"
#include <TTree.h>
#include <TFile.h>
#include <TROOT.h>
#include <TSystem.h>
#include <TTreeFormula.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include "build_gate.h"


using namespace std; 

static UInt_t events_served = 0;

TTime  gTimeStart;

string make_xml(
         const char* inOptions,
         const char* inDstFile,
         const char* inSelection,
         Long64_t inStart,
         Long64_t inEnd )
{
  events_served++;

  // Test code to see what serve_event.cgi will do if the process hangs on an event.
  // if(events_served>2)
  //   { while(true) {;} }

  long eventTimeStart = gSystem->Now();

  // Parse options
  std::string options(inOptions);
  bool oRefresh = false;
  if( std::string::npos != options.find("+REFRESH")) oRefresh = true;

  // Start building the output.
  XmlElement xml("gate");
  
  // Find the file in the list
  TFile* dst = (TFile*)gROOT->GetListOfFiles()->FindObject(inDstFile);
  if(dst && oRefresh) { dst->Close(); delete dst; dst = NULL; }
  if(!dst) dst = new TFile(inDstFile,"READ");
  
  TTree* tree = (TTree*)  dst->Get("minerva");
  
  if(!tree) {
    dst->Close();
    delete dst;
    xml << (XmlElement("error") << std::string("Could not open tree 'minerva' on file ") + inDstFile);
    return xml.str();
  }
  
  // Set the magic root flag to make this work.
  // tree->SetMakeClass(1);
  
  // OK, find the entry in question.
  Int_t ev_gate = -999;
  tree->SetBranchAddress("ev_gate", &ev_gate);
  // tree->SetBranchStatus("*",0);
  // tree->SetBranchStatus("ev_gate",1);
  Long64_t nentries = tree->GetEntriesFast();  
  if(nentries<1){
    dst->Close();
    delete dst;
    xml << (XmlElement("error") << "No entries in tree minerva on file " << inDstFile);
    return xml.str();
  }
  
  
  
  // Scan through entries, looking for specified selection.
  TTreeFormula* select = new TTreeFormula("Selection",inSelection,tree);
  if (!select) {
      xml << "<error>Could not create TTreeFormula.</error>";
      return xml.str();
  }
  if (!select->GetNdim()) { 
    delete select; 
    xml << "<error>Problem with your selection function.</error>";
    return xml.str();
  }

  Long64_t jentry;
  bool match = false;
  if( inStart >=0 ) { 
    // Forward search, situation normal
    Long64_t stop = nentries;
    if(inEnd>0 && inEnd<stop) stop = inEnd;
    for (jentry=inStart; jentry<stop; jentry++) {
      // cerr << "GetEntry(" << jentry << ")" << endl;
      //tree->GetEntry(jentry);
      tree->LoadTree(jentry);
      // Does the selection match any part of the tree?
      int nsel = select->GetNdata();
      for(int i=0;i<nsel;i++) {
        if(select->EvalInstance(i) != 0){
          match = true; break;        
        }
      }
      if(match) break;
    }
  } else {
    // inStart<0 : backward search
    Long64_t start = nentries+inStart;
    if(start>=nentries) start = nentries-1;
    if(start<0) start = 0;
    Long64_t stop = 0;
    if(inEnd>0 && inEnd<=start) stop = inEnd;
    for (jentry=start; jentry>=stop; jentry--) {
      cerr << "GetEntry(" << jentry << ")" << endl;
      //tree->GetEntry(jentry);
      tree->LoadTree(jentry);
      // Does the selection match any part of the tree?
      int nsel = select->GetNdata();
      for(int i=0;i<nsel;i++) {
        if(select->EvalInstance(i) != 0){
          match = true; break;        
        }
      }
      if(match) break;
    }
    
  }
  delete select;
  if(!match) {
    xml << "<error>Selection matched no events in file.</error>";
    return xml.str();
  } 
  
  static Int_t ver_major,ver_rev,ver_patch;
  std::string version_string = 
    find_version_number(inDstFile,tree,jentry,ver_major,ver_rev,ver_patch);
  std::cerr << "Using major version " << ver_major 
            << " minor version " << ver_rev
            << " patch " << ver_patch
            << std::endl;
  
  // Hack: v7r5 development files
  bool dev_version = false;
  string fn(inDstFile);
  if(fn.rfind("_DEV") != string::npos) {
    dev_version = true;
  }
  string::size_type found_dev = fn.rfind("v7r5_DEV");
  
  XmlElement source("source");
  source << XmlElement("reco_version",version_string);
  source << XmlElement("file",inDstFile);
  source << XmlElement("selection",encodeForXml(inSelection));
  source << XmlElement("start",inStart);
  source << XmlElement("end",inEnd);
  source << XmlElement("entry",jentry);
  source << XmlElement("numEntriesInFile",nentries);
  if(dev_version) source << XmlElement("dev_version","true");
  xml << source;  

  XmlElement monitor("ntuple_server_monitor");
  monitor << XmlElement("pid",gSystem->GetPid());
  monitor << XmlElement("events_served",events_served);
  SysInfo_t sysinfo;  gSystem->GetSysInfo(&sysinfo);
  // CpuInfo_t cpuinfo;  gSystem->GetCpuInfo(&cpuinfo);
  MemInfo_t meminfo;  gSystem->GetMemInfo(&meminfo);
  ProcInfo_t procinfo; gSystem->GetProcInfo(&procinfo);
  
  monitor << XmlElement("OS"           , sysinfo.fOS);
  monitor << XmlElement("ComputerModel", sysinfo.fModel);
  monitor << XmlElement("CpuType"      ,  sysinfo.fCpuType);
  monitor << XmlElement("Cpus"         ,  sysinfo.fCpus);
  monitor << XmlElement("CpuSpeed"     ,  sysinfo.fCpuSpeed);
  monitor << XmlElement("PhysicalRam"  ,  sysinfo.fPhysRam);

  monitor << XmlElement("MemTotal"     ,  Form("%d MB",meminfo.fMemTotal));
  monitor << XmlElement("MemUsed"      ,  Form("%d MB",meminfo.fMemUsed));
  monitor << XmlElement("MemFree"      ,  Form("%d MB",meminfo.fMemFree));
  monitor << XmlElement("SwapTotal"    ,  Form("%d MB",meminfo.fSwapTotal));
  monitor << XmlElement("SwapUsed"     ,  Form("%d MB",meminfo.fSwapUsed));
  monitor << XmlElement("SwapFree"     ,  Form("%d MB",meminfo.fSwapFree));

  monitor << XmlElement("CpuTimeUser"     ,  procinfo.fCpuUser);
  monitor << XmlElement("CpuTimeSys"     ,   procinfo.fCpuSys);
  monitor << XmlElement("MemResident"    ,   Form("%f MB",procinfo.fMemResident/1000.));
  monitor << XmlElement("MemVirtual"     ,   Form("%f MB",procinfo.fMemVirtual/1000.));

  monitor << XmlElement("WallClockTime"  ,   ((long)(gSystem->Now() - gTimeStart))/1000.);
  xml << monitor;

  // 
  // Get it.
  //
  Int_t bytesRead = tree->GetEntry(jentry);
  if(bytesRead<0) {
    cout << "Error: I/O error on GetEntry trying to read entry " << jentry;
    xml << XmlElement("error","I/O error on GetEntry");
    return xml.str();
  }
  if(bytesRead==0) {
    cout << "Error: Nonexistent entry reported by GetEntry trying to read entry " << jentry;
    xml << XmlElement("error","Entry does not exist on tree");
    return xml.str();
  }


  // Here's where all the joy happens.
  build_gate(xml,tree,jentry,ver_major,ver_rev,ver_patch,dev_version);

  // Always close the file - let's see if this stops memory leaks.
  dst->Close(); delete dst;
  
  xml << XmlElement("ElapsedServerTime",((long)(gSystem->Now()) - eventTimeStart));
  
  return xml.str();
}





std::string find_version_number(
    const char* inDstFile,
    TTree* inTree,
    Long64_t jentry,
    int &ver_major,
    int &ver_rev,
    int &ver_patch
    )
{
  // Attempt to find data in the branch.
  string ver("");
  
  ver_major = -1;
  ver_rev = -1;
  ver_patch = 0;

  TBranch* br_major = inTree->GetBranch("fmwk_v");
  if(br_major) {
    TBranch* br_rev = inTree->GetBranch("fmwk_r");
    if(br_rev) {
      TBranch* br_patch = inTree->GetBranch("fmwk_p");
      if(br_patch) {
        br_major->SetAddress(&ver_major);
        br_rev ->SetAddress(&ver_rev);
        br_patch->SetAddress(&ver_patch);
        inTree->GetEntry(jentry);
        if(ver_major>0) {
          if(ver_patch>0)
            ver = Form("v%dr%dp%d",ver_major,ver_rev,ver_patch);
          else
            ver = Form("v%dr%d",ver_major,ver_rev);
          cerr << "Building version string from ntuple data: " << ver << std::endl;
          return ver;
        }
      }
    }
  }  
  
  // Attempt to glean the version number from the filename.
  string fn(inDstFile);
  // Find the last substring bracketed by DST_ at the start and . or _ or - at the end.
  string::size_type i = fn.rfind("DST_");
  if(i != string::npos) {
    i+=4; // Skip to end of substring.
    string::size_type j = fn.find_first_of("_.-",i);
    string::size_type l = string::npos; // | 
    if(j!=string::npos) l = j-i;   // |
    ver = fn.substr(i,l); 
  }
  if(ver.length()>0) {
    // Find major version number.
     sscanf(ver.c_str(),"v%dr%dp%d",&ver_major,&ver_rev,&ver_patch);
    cerr << "Decomposing version string. " << ver.c_str() << "\t" << ver_major << "\t" << ver_rev << "\t" << ver_patch << endl;
    return ver;
  }
  
  // OK, that failed. Does the file start with MV?
  i = fn.find_last_of("/");
  if(fn[i+1]=='M' && fn[i+2]=='V') {
    ver_major = 7;
    ver_rev = 3;
    ver_patch = 1;
    return "v7r3p1";
  }
  return "UNKNOWN";
}

