// hello.cc
#include <node.h>

#include "DeadChannelMap.h"
#include "ResultComposer.h"
#include "Plexus.h"
#include <iostream>
#include <uv.h>
#include <iostream>
#include <unistd.h>

extern gov::fnal::uboone::online::Plexus gPlexus;

namespace demo {

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;
using v8::Handle;

#include <stdio.h>
#include <time.h>



// Should happen at library load time. I think this stops the crashes?
class initializer {
public: 
  initializer() { ArgoInitGlobals();}
};
initializer i;
  
// VoidFuncPtr_t initfuncs[] = { 0 };
// TROOT root("Rint", "The ROOT Interactive Interface", initfuncs);

// To Do:
// Add a function to build or rebuild global plexus object.
// Rewrite the Method function into GetEventRaw and GetEventRoot
//   each should look like the argo-live-backend.cc code, where they configure the RecordComposer manually, instead of like this below.
// Add a filepicker somewhere.

// find a way to serve images to the web page
//   .. write temporary files and then serve them; could be easy if I just get URLs right, above
//   .. instead of writing to files, stream to set of rotating buffers, and and serve via local HTTP-over-socket with node
//   .. hope I get someone responding to my StackOverflow question

// Avoid having to use DYLD_LIBRARY_PATH.  I think I can copy the library files to a subdirectory here and then 
// use -install_name at gcc time or install_name_tool -change  on the command line

void ComposeSync(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  // args.GetReturnValue().Set(String::NewFromUtf8(isolate, "This is my string."));
  // TH1* h = new TH1D("h","h",10,0,100);
  // h->Fill(50,2);
  // h->Print();
  // JsonObject obj;
  // obj.add("property1","value1");
  // obj.add("property2","value2");
  // args.GetReturnValue().Set(String::NewFromUtf8(isolate, obj.str().c_str()));

  // Input: 
  // { options: "", filename: "", selection: "", entrystart: 0, entryend: 1000000000 }
  
   std::string options = "";
   std::string filename = "";
   std::string selection= "";
   int64_t entrystart=0;
   int64_t entryend=1000000000;

   if(args.Length()>0 && args[0]->IsObject()) {
     Handle<Object> object = Handle<Object>::Cast(args[0]);

     Handle<Value> optionsValue = object->Get(String::NewFromUtf8(isolate,"options"));
     if(optionsValue->IsString())   options = *String::Utf8Value(optionsValue);

     Handle<Value> filenameValue = object->Get(String::NewFromUtf8(isolate,"filename"));
     if(filenameValue->IsString())   filename = *String::Utf8Value(filenameValue);

     Handle<Value> selectionValue = object->Get(String::NewFromUtf8(isolate,"selection"));
     if(selectionValue->IsString())   selection = *String::Utf8Value(selectionValue);

     Handle<Value> startValue = object->Get(String::NewFromUtf8(isolate,"entrystart"));
     if(startValue->IsNumber())   entrystart = startValue->NumberValue();

     Handle<Value> endValue = object->Get(String::NewFromUtf8(isolate,"entryend"));
     if(endValue->IsNumber())   entryend = endValue->NumberValue();

     // v8::Local<v8::Object> jsonObj = args[0]->ToObject();
     //
     // v8::Local<v8::String> optionsProp     = Nan::New("options").ToLocalChecked();
     // v8::Local<v8::String> filenameProp    = Nan::New("filename").ToLocalChecked();
     // v8::Local<v8::String> selectionProp   = Nan::New("selection").ToLocalChecked();
     // v8::Local<v8::String> entrystartProp  = Nan::New("entrystart").ToLocalChecked();
     // v8::Local<v8::String> entryendProp    = Nan::New("entryend").ToLocalChecked();
     //
     // if (Nan::HasOwnProperty(jsonObj, optionsProp).FromJust()) {
     //   options = std::string(*Nan::Utf8String(Nan::Get(jsonObj, optionsProp)->ToString()));
     // }
     // if (Nan::HasOwnProperty(jsonObj, filenameProp).FromJust()) {
     //   filename = std::string(*Nan::Utf8String(Nan::Get(jsonObj, filenameProp)->ToString()));
     // }
     // if (Nan::HasOwnProperty(jsonObj, selectionProp).FromJust()) {
     //   filename = std::string(*Nan::Utf8String(Nan::Get(jsonObj, selectionProp)->ToString()));
     // }
     //
     //
     // if (Nan::HasOwnProperty(jsonObj, entrystartProp).FromJust()) {
     //   entrystart = Nan::Get(jsonObj, entrystartProp)->NumberValue();
     // }
     // if (Nan::HasOwnProperty(jsonObj, entryendProp).FromJust()) {
     //   entryend = Nan::Get(jsonObj, entrystartProp)->NumberValue();
     // }



   }

   // if(args.Length()>=4) {
   //   if(args[3]->IsNumber())
   //   entrystart = args[3]->NumberValue();
   // }
   //
   // if(args.Length()>=4) {
   //   if(args[3]->IsNumber())
   //   entrystart = args[3]->IntegerValue();
   // }
   // if(args.Length()>=5) {
   //   if(args[4]->IsNumber())
   //   entryend = args[4]->IntegerValue();
   // }
   //
   std::cout << "Options    = " << options << std::endl;
   std::cout << "Filename   = " << filename << std::endl;
   std::cout << "Selection  = " << selection << std::endl;
   std::cout << "Entrystart = " << entrystart << std::endl;
   std::cout << "Entryend   = " << entryend << std::endl;

   ResultComposer::config_t rc_cfg;
   rc_cfg["CacheStoragePath"] = "datacache";
   rc_cfg["CacheStorageUrl"]  = "datacache";
   ResultComposer rc(rc_cfg);
   
    std::shared_ptr<std::string> payload = rc.compose(options.c_str(),filename.c_str(),selection.c_str(), entrystart, entryend);
    args.GetReturnValue().Set(String::NewFromUtf8(isolate, payload->c_str()));
}



/////////////////////

struct Work {
  uv_work_t  request;
  v8::Persistent<v8::Function> callback;

  std::string filename;
  std::string options;
  std::string selection;
  int64_t entrystart;
  int64_t entryend;
  
  std::shared_ptr<std::string> result;
};

// called by libuv worker in separate thread
static void DoComposeAsync(uv_work_t *req)
{
    Work *work = static_cast<Work *>(req->data);

    // this is the worker thread, lets build up the results
    // allocated results from the heap because we'll need
    // to access in the event loop later to send back
    std::cout << "Options    = " << work->options << std::endl;
    std::cout << "Filename   = " << work->filename << std::endl;
    std::cout << "Selection  = " << work->selection << std::endl;
    std::cout << "Entrystart = " << work->entrystart << std::endl;
    std::cout << "Entryend   = " << work->entryend << std::endl;
    
    ResultComposer::config_t rc_cfg;
    rc_cfg["CacheStoragePath"] = "datacache";
    rc_cfg["CacheStorageUrl"]  = "datacache";
    ResultComposer rc(rc_cfg);
    work->result = rc.compose(work->options.c_str(),work->filename.c_str(),work->selection.c_str(), work->entrystart, work->entryend);
}

// called by libuv worker in separate thread
static void ComposeAsyncComplete(uv_work_t *req, int status)
{
  Isolate * isolate = Isolate::GetCurrent();
  v8::HandleScope handleScope(isolate);

  Work *work = static_cast<Work *>(req->data);
  Local<String> result = String::NewFromUtf8(isolate, work->result->c_str());
    

  // set up return arguments
  Handle<Value> argv[] = { result };

  // execute the callback
  // https://stackoverflow.com/questions/13826803/calling-javascript-function-from-a-c-callback-in-v8/28554065#28554065
  Local<v8::Function>::New(isolate, work->callback)->Call(isolate->GetCurrentContext()->Global(), 1, argv);

  // Free up the persistent function callback
  work->callback.Reset();
  delete work;

}


void ComposeAsync(const v8::FunctionCallbackInfo<v8::Value>&args) {
    Isolate* isolate = args.GetIsolate();

    Work * work = new Work();
    work->request.data = work;

    std::string options = "";
    std::string filename = "";
    std::string selection= "";
    int64_t entrystart=0;
    int64_t entryend=1000000000;

    if(args.Length()>0 && args[0]->IsObject()) {
      Handle<Object> object = Handle<Object>::Cast(args[0]);
    
      Handle<Value> optionsValue = object->Get(String::NewFromUtf8(isolate,"options"));
      if(optionsValue->IsString())   options = *String::Utf8Value(optionsValue);

      Handle<Value> filenameValue = object->Get(String::NewFromUtf8(isolate,"filename"));
      if(filenameValue->IsString())   filename = *String::Utf8Value(filenameValue);

      Handle<Value> selectionValue = object->Get(String::NewFromUtf8(isolate,"selection"));
      if(selectionValue->IsString())   selection = *String::Utf8Value(selectionValue);
     
      Handle<Value> startValue = object->Get(String::NewFromUtf8(isolate,"entrystart"));
      if(startValue->IsNumber())   entrystart = startValue->NumberValue();

      Handle<Value> endValue = object->Get(String::NewFromUtf8(isolate,"entryend"));
      if(endValue->IsNumber())   entryend = endValue->NumberValue();
     

    }
    work->options = options;
    work->filename = filename;
    work->selection = selection;
    work->entrystart = entrystart;
    work->entryend = entryend;

    // store the callback from JS in the work package so we can
    // invoke it later
    Local<v8::Function> callback = Local<v8::Function>::Cast(args[1]);
    work->callback.Reset(isolate, callback);

    // kick of the worker thread
    uv_queue_work(uv_default_loop(),&work->request,DoComposeAsync,ComposeAsyncComplete);


    args.GetReturnValue().Set(Undefined(isolate));
}

void init(Local<Object> exports) {
  // Try to turn off ROOT error trapping.
  //gSystem->ResetSignals();
  // Declare a method to be seen by javascript.
  NODE_SET_METHOD(exports, "compose_sync", ComposeSync);
  NODE_SET_METHOD(exports, "compose_async", ComposeAsync);

  // To store our image files, we'll need some temporary storage space.  On MAC, it's the $TMPDIR directory
  const char* tmpdir = getenv("TMPDIR");
  if(!tmpdir) {
    std::cerr << "Couldn't lookup $TMPDIR" << std::endl;
    // mkdir("datacache",0777);
  } else {
    symlink(tmpdir,"datacache");
  }
  // Plexus.  
    //
    if(!gPlexus.is_ok()) {
      gPlexus.assignSources(
          "sqlite ../db/current-plexus.db",
          "sqlite ../db/current-plexus.db",
          "",
          ""
      );
      time_t seconds = time (NULL);
      gPlexus.rebuild((double)(seconds));
    }
    gDeadChannelMap->Rebuild("../db/dead_channels.txt");
  //
  //
}


///               initialization routine which declares methods accessible
///                vvvv 
NODE_MODULE(patch, init)
///         ^^^ 
///     module name in javascript

}  // namespace demo