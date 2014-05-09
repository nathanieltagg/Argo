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
#include <sys/file.h>

#include <TROOT.h>
#include <TRint.h>
#include <TStyle.h>
#include <TSystem.h>
#include <TTimeStamp.h>
#include <TError.h>
#include <TKey.h>
#include <TClass.h>
#include <regex.h>
#include <TROOT.h>

#include "JsonElement.h"
#include "TFile.h"
#include "TH1.h"
#include "TH2.h"
#include "RootToJson.h"

TFile* getlocked(const char* filename, const char* mode)
{
  //open a dummy version of the file.
  int fd = open(filename,O_RDONLY);
  flock(fd,LOCK_SH);
  // When we've got the lock open by ROOT...
  TFile* f = new TFile(filename,mode);
  flock(f->GetFd(),LOCK_SH);
  // and now close our original file descriptor
  close(fd);
  return f;
}

using namespace std;


vector<string> split(   /* Altered/returned value */
       const  string  & theString,
       const  string  & theDelimiter)
{
  vector<string> theStringVector;
  size_t  start = 0, end = 0;
  while ( end != string::npos) {
      end = theString.find( theDelimiter, start);
      theStringVector.push_back( theString.substr( start,
                     (end == string::npos) ? string::npos : end - start));
      start = (   ( end > (string::npos - theDelimiter.size()) )
                ?  string::npos  :  end + theDelimiter.size());
  }
  return theStringVector;
}

// Toooo messy. 
/*
void getObjListing(TDirectory* dir, std::string path, JsonArray &arr)
{
  TKey *key;
  TIter nextobj(dir->GetListOfKeys());
  while ((key = (TKey *) nextobj())) {
    const char *classname = key->GetClassName();
    TClass *cl = gROOT->GetClass(classname);
    if (!cl) continue;
    if (cl->InheritsFrom("TDirectory")) {
      TDirectory* subdir = dir->GetDirectory(key->GetName());
      if(subdir) getObjListing(subdir,path+key->GetName()+"/",arr);
    } else {
      arr.add(path+key->GetName());
    }
 } 
}*/

void getObjHtmlListing(TDirectory* dir, std::string path, std::string &list)
{
  // Get a complete object tree, in the form required by jstree.jquery.js

  // First, get a set of keys. Build a maps of key names. This lets us
  //  - sort by directory first, then real items
  //  - ignore cycle numbers.
  
  std::map<std::string,TKey*> map_subdirs;
  std::map<std::string,TKey*> map_hists;


  TKey *key;
  TIter nextobj(dir->GetListOfKeys());
  while ((key = (TKey *) nextobj())) {
    const char *classname = key->GetClassName();
    TClass *cl = gROOT->GetClass(classname);
    if (!cl) continue;
    if (cl->InheritsFrom("TDirectory")) {
      map_subdirs[key->GetName()] = key;
    } else if (cl->InheritsFrom("TH1")) {
      map_hists[key->GetName()] = key;
    } else if (0==strncmp(key->GetName(),"DirectoryInfo",14)) {
      map_hists[key->GetName()] = key;
    }
  }

  std::map<std::string,TKey*>::iterator it;
  
  list = "<ul class='om_subdirlist' data-ompath='"+path+"'>";
  
  for(it = map_subdirs.begin(); it!=map_subdirs.end(); it++) {
    key = it->second;
    TDirectory* subdir = dir->GetDirectory(key->GetName());
    if(subdir) {      
      std::string children;  
      getObjHtmlListing(subdir,path+key->GetName()+"/",children);

      list += "<li class='om-dir' data-ompath='"+path+key->GetName()+"'>";
      list += "<a href='#"+path+key->GetName()+"'";
      list += " class='om-dir-title'";
      list += " data-ompath='"+path+key->GetName()+"'>" + key->GetName() + "</a>";
      list += children;
      list += "</li>";
    }    
  }
  
  for(it = map_hists.begin(); it!=map_hists.end(); it++) {
    key = it->second;
    list += std::string("<li><a href='#"+path+key->GetName()+"'"
         +" class='om-elem root-")+key->GetClassName()+"'"
         +" data-roottype='" + key->GetClassName() + "'"
         +" data-ompath='"+path+key->GetName()+"'"           
         + ">";
    list += key->GetName();
    list += "</a></li>";
  }
  list += "</ul>";
  
}

void getObjListing(TDirectory* dir, std::string path, JsonArray &arr)
{
  // Get a complete object tree, in the form required by jstree.jquery.js

  // First, get a set of keys. Build a maps of key names. This lets us
  //  - sort by directory first, then real items
  //  - ignore cycle numbers.
  
  std::map<std::string,TKey*> map_subdirs;
  std::map<std::string,TKey*> map_hists;


  TKey *key;
  TIter nextobj(dir->GetListOfKeys());
  while ((key = (TKey *) nextobj())) {
    const char *classname = key->GetClassName();
    TClass *cl = gROOT->GetClass(classname);
    if (!cl) continue;
    if (cl->InheritsFrom("TDirectory")) {
      map_subdirs[key->GetName()] = key;
    } else if (cl->InheritsFrom("TH1")) {
      map_hists[key->GetName()] = key;
    }
  }

  std::map<std::string,TKey*>::iterator it;
  
  for(it = map_subdirs.begin(); it!=map_subdirs.end(); it++) {
    key = it->second;
    TDirectory* subdir = dir->GetDirectory(key->GetName());
    if(subdir) {     
      JsonArray children;  
      getObjListing(subdir,path+key->GetName()+"/",children);
      JsonObject node;
      node.add("data",key->GetName());
      JsonObject metadata;
      metadata.add("path",path+key->GetName()+"/");
      metadata.add("title",key->GetTitle());
      metadata.add("type",key->GetClassName());
      node.add("metadata",metadata);
      node.add("children",children);
      arr.add(node);
    }    
  }
  
  for(it = map_hists.begin(); it!=map_hists.end(); it++) {
    key = it->second;
    JsonObject node;
    node.add("data",key->GetName());
    JsonObject metadata;
    metadata.add("path",path+key->GetName()+"/");
    metadata.add("title",key->GetTitle());
    metadata.add("type",key->GetClassName());      
    node.add("metadata",metadata);
    arr.add(node);
  }

 //  TIter nextobj(dir->GetListOfKeys());
 //  while ((key = (TKey *) nextobj())) {
 //    const char *classname = key->GetClassName();
 //    TClass *cl = gROOT->GetClass(classname);
 //    if (!cl) continue;
 //    if (cl->InheritsFrom("TDirectory")) {
 //      map_subdirs[key->GetName()] = key;
 //      TDirectory* subdir = dir->GetDirectory(key->GetName());
 //      if(subdir) {     
 //        JsonArray children;  
 //        getObjListing(subdir,path+key->GetName()+"/",children);
 //        JsonObject node;
 //        node.add("data",key->GetName());
 //        JsonObject metadata;
 //        metadata.add("path",path+key->GetName()+"/");
 //        metadata.add("title",key->GetTitle());
 //        metadata.add("type",classname);
 //        node.add("metadata",metadata);
 //        node.add("children",children);
 //        arr.add(node);
 //      }
 //    } else {
 //      JsonObject node;
 //      node.add("data",key->GetName());
 //      JsonObject metadata;
 //      metadata.add("path",path+key->GetName()+"/");
 //      metadata.add("title",key->GetTitle());
 //      metadata.add("type",classname);      
 //      node.add("metadata",metadata);
 //      arr.add(node);
 //    }
 // } 
  
}



std::string ComposeResult(const std::string& filename, const std::string& histname, const std::string& options)
{
  // Now do your stuff.

  // Parse options.
  int maxbins = 0;

  // look for :lowres<nbins>:
  size_t loc = options.find(":lowres");
  if(loc != std::string::npos) {
    ::sscanf(options.c_str()+loc+7,"%d",&maxbins);
    std::cout << "Maxbins " << options.c_str()+loc << " set to " << maxbins << std::endl;    
  }
  // open file:
  JsonObject result;
  
  TFile* f = getlocked(filename.c_str(),"READ");
  if(f->IsZombie()) {
    result.add("error","Could not find filename "+filename);
    try{delete f;} catch(...) {cerr << "Error deleting file!";}
    return result.str();
  }
  
  // Create metata object showing state of file.
  JsonObject cycle;
  cycle.add("filename",filename);
  
  TTimeStamp *ttimestamp = 0;
  f->GetObject("updateTimeStamp",    ttimestamp); if(ttimestamp) cycle.add("updateTime",ttimestamp->AsString("c"));  // Javascript likes the near ISO-8601 compliant version, lets use that.
  ttimestamp = 0;
  f->GetObject("firstEventTimeStamp",ttimestamp); if(ttimestamp) cycle.add("firstEventTime",ttimestamp->AsString("c"));  
  ttimestamp = 0;
  f->GetObject("lastEventTimeStamp", ttimestamp); if(ttimestamp) cycle.add("lastEventTime",ttimestamp->AsString("c"));  

  TNamed* nmd;
  f->GetObject("run",nmd);    if(nmd) cycle.add(nmd->GetName(),nmd->GetTitle());
  f->GetObject("subrun",nmd); if(nmd) cycle.add(nmd->GetName(),nmd->GetTitle());
  f->GetObject("event",nmd);  if(nmd) cycle.add(nmd->GetName(),nmd->GetTitle());
  
  result.add("cycle",cycle);
  
  // Seperate space-delimited listing of histname objects.
  vector<string> histnames = split(histname,":");
  
  JsonObject shipment;
  for(int ih=0;ih<histnames.size();ih++) {
    std::string hname = histnames[ih];

    // Handle special case requests
    if(hname == "HLIST") {
      std::string list;
      getObjHtmlListing(f,"",list);
      shipment.add("HLIST",list);
      
     } else if(hname == "LIST") {
      JsonArray arr;
      getObjListing(f,"",arr); 
      shipment.add("LIST",arr);      
      
    } else {
    
      // Lets' look for a pathname
      // Find directory and object
      std::string name;
      std::string path;
      size_t pos = hname.find_last_of("/");
      if(pos != std::string::npos){
        path.assign(hname,0,pos);
        name.assign(hname.begin()+pos+1,hname.end());
      } else {
        path = "";
        name = hname;
      }
      TDirectory* dir = f->GetDirectory(path.c_str(), false);
      if(!dir) {
        result.add("error","Could not find path "+path);
        continue;
      }
  
      // Attempt to find object.
      TObject* o = dir->Get(name.c_str());
      if(!o) {
        result.add("error","Could not find object "+name);
        continue;
      }
  
      if(o->InheritsFrom(TH2::Class()))      shipment.add(hname,TH2ToHistogram((TH2*)o,maxbins)); 
      else if(o->InheritsFrom(TH1::Class())) shipment.add(hname,TH1ToHistogram((TH2*)o,maxbins)); 
      else if(o->InheritsFrom(TNamed::Class()) && name=="DirectoryInfo") {
        TNamed* info = dynamic_cast<TNamed*>(o);
        if(!info) continue;
        JsonElement jel;        
        jel.setStr(info->GetTitle());
        shipment.add(hname,jel);
      }
    
      
    }
  }
  result.add("shipment",shipment);
  delete f;
  return result.str();
}

