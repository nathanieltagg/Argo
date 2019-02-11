#include "ComposerWrapper.h"
#include "UniversalComposer.h"

#include <iostream>

// Good notes from the NAN site, as well as
// https://medium.com/netscape/tutorial-building-native-c-modules-for-node-js-using-nan-part-1-755b07389c7c

namespace argo {

using v8::Context;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::NewStringType;
using v8::Number;
using v8::Object;
using v8::Persistent;
using v8::String;
using v8::Value;



// Wrapper that allows continuous streaming output via callback. Based on "progress".
// See https://github.com/nodejs/nan/blob/master/test/cpp/asyncprogressworker.cpp



class MyProgressWorker : public Nan::AsyncProgressWorker{
public:
  ComposerWrapper* composerWrap;
  Nan::Callback* output_callback;
  Request_t request;
  Output_t output;
    
  MyProgressWorker( 
                    ComposerWrapper* c,
                    Request_t req, Nan::Callback* ioutput_callback, Nan::Callback *idone_callback )
    : Nan::AsyncProgressWorker(idone_callback)
    , composerWrap(c)
    , output_callback(ioutput_callback) 
    , request(req)
    , output(new std::string)
  {
  }

  ~MyProgressWorker() { 
    std::cout << "MYPROGRESSWORKER DELETEING" << std::endl;
    delete output_callback; 
  }


  void do_output(const ExecutionProgress& progress, Composer::OutputType_t type, Output_t output) 
  {
    if(output) progress.Send(output->c_str(),output->size());
  }

  void Execute(const ExecutionProgress &ep) {
    // Bind this composer's OutputCallback_t call to do_output    
    Composer::OutputCallback_t cb = std::bind(
      &MyProgressWorker::do_output,
      this,
       std::ref(ep),
      std::placeholders::_1, std::placeholders::_2);
    // ComposerWrapper* composerWrap = Nan::ObjectWrap::Unwrap<ComposerWrapper>(composerHandle);
    if(composerWrap->m_running) std::cout << "OH NO TRIED TO START an ASYNC REQUEST WHEN ONE WAS ALREADY RUNNING" << std::endl;
    composerWrap->set_output_callback(cb);
    composerWrap->m_running = true;
    output = composerWrap->satisfy_request_ref(request);
    composerWrap->m_running = false;

  }

  void HandleOKCallback() {
    std::cout << "HANDLE OK CALLBACK()" << std::endl;
    Nan::HandleScope scope;
    v8::Local<v8::Value> argv[] = {
      Nan::New(*output).ToLocalChecked()
    };
    Nan::Call(callback->GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
  }

  void HandleErrorCallback() {
    std::cout << "HANDLE ERROR CALLBACK()" << std::endl;
    Nan::HandleScope scope;
    v8::Local<v8::Value> argv[] = {
      Nan::New(this->ErrorMessage()).ToLocalChecked(), // return error message
      Nan::Null()
    };
    Nan::Call(callback->GetFunction(), Nan::GetCurrentContext()->Global(), 2, argv);
  }
  
  void HandleProgressCallback(const char *data, size_t count) {
     Nan::HandleScope scope;

     v8::Local<v8::Value> argv[] = {
         Nan::New(std::string(data,count)).ToLocalChecked()
     };
     output_callback->Call(1, argv, async_resource);
   }
};


// A wrapper for the UniversalComposer, so that Javascript can hold on to it..
Nan::Persistent<v8::FunctionTemplate> ComposerWrapper::constructor;

ComposerWrapper::ComposerWrapper(const std::string& config) : UniversalComposer()
{
  Config_t c(new nlohmann::json(nlohmann::json::parse(config)));
  std::cout << "Configure with " << c->dump(2) << std::endl;
  configure(c);
  m_running = false;
}

ComposerWrapper::~ComposerWrapper() {
  if(m_running) std::cout << "OH NO TRIED TO DESTROY COMPOSER WHILE IT WAS STILL RUNNING!!!" << std::endl;
}

NAN_MODULE_INIT(ComposerWrapper::Init) {
  // Ensure ROOT is ready for threading
  
  v8::Local<v8::FunctionTemplate> ctor = Nan::New<v8::FunctionTemplate>(ComposerWrapper::New);
  constructor.Reset(ctor);
  ctor->InstanceTemplate()->SetInternalFieldCount(1);
  ctor->SetClassName(Nan::New("Composer").ToLocalChecked());
  Nan::SetPrototypeMethod(ctor, "composeSync", composeSync);
  Nan::SetPrototypeMethod(ctor, "composeIncremental", composeIncremental);
  
  target->Set(Nan::New("Composer").ToLocalChecked(), ctor->GetFunction());
 }


// void ComposerWrapper::New(const FunctionCallbackInfo<Value>& args) {
NAN_METHOD(ComposerWrapper::New) 
{
  Isolate* isolate = info.GetIsolate();
  /*Local<Context> context = */isolate->GetCurrentContext();

  if (info.IsConstructCall()) {
    // Invoked as constructor: `new Factory(...)`
    std::string configstr = "{}";
    if (info.Length() > 0) {
      Nan::MaybeLocal<v8::Object> maybe_obj = Nan::To<v8::Object>(info[0]);
      if (!maybe_obj.IsEmpty()) {
        v8::Local<v8::Object> obj = maybe_obj.ToLocalChecked();
        Nan::JSON NanJSON;
        v8::Local<v8::String> v8string = NanJSON.Stringify(obj).ToLocalChecked();
        v8::String::Utf8Value s(isolate,v8string);
        configstr = *s;
      }
    }
    ComposerWrapper* obj = new ComposerWrapper(configstr);  
    obj->Wrap(info.This());
    info.GetReturnValue().Set(info.This());
  } else {
    std::cout << "Must provide config" << std::endl;
  }
}

NAN_METHOD(ComposerWrapper::composeSync)
{
  // This call is here like the old version: simple request, ignore all callbacks. No threading or any crap like that.
  Isolate* isolate = info.GetIsolate();

  ComposerWrapper* composerWrap = ObjectWrap::Unwrap<ComposerWrapper>(info.Holder());
  if(!info[0]->IsObject()) {
    return Nan::ThrowError(Nan::New("Need a request object as first argument.").ToLocalChecked());
  }
  // Wrap up the request object.
  if (info.Length() > 0) {
    Nan::MaybeLocal<v8::Object> maybe_obj = Nan::To<v8::Object>(info[0]);
    if (!maybe_obj.IsEmpty()) {
      v8::Local<v8::Object> obj = maybe_obj.ToLocalChecked();
      Nan::JSON NanJSON;
      v8::Local<v8::String> v8string = NanJSON.Stringify(obj).ToLocalChecked();
      v8::String::Utf8Value s(isolate,v8string);
      Request_t request(new nlohmann::json(nlohmann::json::parse(*s)));
      if(composerWrap->m_running) std::cout << "OH NO TRIED TO START A SYNC REQUEST WHEN ONE WAS ALREADY RUNNING" << std::endl;
      composerWrap->m_running = true;
      Output_t output = composerWrap->satisfy_request_ref(request);
      composerWrap->m_running = false;
      Local<String> retval = String::NewFromUtf8(isolate, output->c_str());
      info.GetReturnValue().Set(retval);
    }
  } else {
    return Nan::ThrowError(Nan::New("Need a request object as first argument.").ToLocalChecked());
  }
  
}


// Async
NAN_METHOD(ComposerWrapper::composeIncremental)
{
  Isolate* isolate = info.GetIsolate();
  v8::Local<v8::Object> composerHandle = info.Holder();
  ComposerWrapper* composerWrap = ObjectWrap::Unwrap<ComposerWrapper>(composerHandle);
  if(!info[0]->IsObject()) {
    return Nan::ThrowError(Nan::New("Need a request object as first argument.").ToLocalChecked());
  }
  Request_t request(new nlohmann::json(nlohmann::json::object()));
  Nan::MaybeLocal<v8::Object> maybe_obj = Nan::To<v8::Object>(info[0]);
  if (!maybe_obj.IsEmpty()) {
    v8::Local<v8::Object> obj = maybe_obj.ToLocalChecked();
    Nan::JSON NanJSON;
    v8::Local<v8::String> v8string = NanJSON.Stringify(obj).ToLocalChecked();
    v8::String::Utf8Value s(isolate,v8string);
    request = Request_t(new nlohmann::json(nlohmann::json::parse(*s)));
  }
    
  if(!info[1]->IsFunction()) {
    return Nan::ThrowError(Nan::New("Need a callback function as the second argument").ToLocalChecked());
  }
  if(!info[2]->IsFunction()) {
    return Nan::ThrowError(Nan::New("Need a progress callback function as the third argument").ToLocalChecked());
  }
  
 // starting the async worker
  Nan::AsyncQueueWorker(new MyProgressWorker(
    // composerWrap->persistent(),
    composerWrap,
    request,
    new Nan::Callback(info[2].As<v8::Function>()),
    new Nan::Callback(info[1].As<v8::Function>())
  ));
  
}

Output_t ComposerWrapper::satisfy_request_ref(Request_t req)
{
  // Ref();
  Output_t res = satisfy_request(req);
  // Unref();
  return res;
}



// Initialize the whole module.

  // void InitAll(Local<Object> exports) {
  //   Factory::Init(exports);
  // }

  // void InitAll(Local<Object> exports, Local<Object> module) {
  //   // Factory::Init(exports);
  //   NODE_SET_METHOD(module, "exports", Factory::New);
  // }
  //
  NODE_MODULE(NODE_GYP_MODULE_NAME, ComposerWrapper::Init)


}  // namespace argo

