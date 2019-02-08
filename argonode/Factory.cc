#include "Factory.h"
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


// Worker object that works asyncrounously to build an event.

class MyFactoryWorker : public Nan::AsyncWorker {
public:
  UniversalComposerWrap* factory;
  Request_t request;
  Output_t output;
    
  MyFactoryWorker(UniversalComposerWrap* f, Request_t req, Nan::Callback *done_callback )
    : Nan::AsyncWorker(done_callback)
    , factory(f)
    , request(req)
    , output(new std::string)
  {}

  void Execute() {
    // if (throwsError) {
    //   this->SetErrorMessage("An error occured!");
    //   return;
    // }
    output = factory->satisfy_request(request);
  }

  void HandleOKCallback() {
    Nan::HandleScope scope;
    v8::Local<v8::Value> argv[] = {
      Nan::New(*output).ToLocalChecked()
    };
    Nan::Call(callback->GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
  }

  void HandleErrorCallback() {
    Nan::HandleScope scope;
    v8::Local<v8::Value> argv[] = {
      Nan::New(this->ErrorMessage()).ToLocalChecked(), // return error message
      Nan::Null()
    };
    Nan::Call(callback->GetFunction(), Nan::GetCurrentContext()->Global(), 2, argv);
  }
};


// Wrapper that allows progress calls.
// See https://github.com/nodejs/nan/blob/master/test/cpp/asyncprogressworker.cpp

class MyFactoryWorkerWithProgress : public Nan::AsyncProgressWorker{
public:
  Nan::Callback* progress_callback;
  UniversalComposerWrap* factory;
  Request_t request;
  Output_t output;
    
  MyFactoryWorkerWithProgress(UniversalComposerWrap* f, Request_t req, Nan::Callback* progress_callback, Nan::Callback *done_callback )
    : Nan::AsyncProgressWorker(done_callback)
    , progress_callback(progress_callback) 
    , factory(f)
    , request(req)
    , output(new std::string)
  {}

  ~MyFactoryWorkerWithProgress() { delete progress_callback; }


  void do_output(const Nan::AsyncProgressWorker::ExecutionProgress& progress, Composer::OutputType_t type, Output_t output) 
  {
    nlohmann::json report;
    report["type"] = Composer::to_string(type);
    report["output"] = (output)?(*output):""; 
    std::string out = report.dump();
    progress.Send(out.c_str(), out.size());
  }

  void Execute(const Nan::AsyncProgressWorker::ExecutionProgress &ep) {
    // Bind this object's do_progress() call to 
    
    Composer::OutputCallback_t cb = std::bind(
      &MyFactoryWorkerWithProgress::do_output,
      this,
       std::ref(ep),
      std::placeholders::_1, std::placeholders::_2);
    // try{
      factory->set_output_callback(cb);
      output = factory->satisfy_request(request);      
    // } catch (std::exception& e) {
    //   Nan::ThrowError(e.what());
    // }
    
  }

  void HandleOKCallback() {
    Nan::HandleScope scope;
    v8::Local<v8::Value> argv[] = {
      Nan::New(*output).ToLocalChecked()
    };
    Nan::Call(callback->GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
  }

  void HandleErrorCallback() {
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
     progress_callback->Call(1, argv, async_resource);
   }
};


// A wrapper for ComposerFactory.

Nan::Persistent<v8::FunctionTemplate> UniversalComposerWrap::constructor;

UniversalComposerWrap::UniversalComposerWrap(const std::string& config) : UniversalComposer()
{
  Config_t c(new nlohmann::json(nlohmann::json::parse(config)));
  std::cout << "Configure with " << c->dump(2) << std::endl;
  configure(c);
}

UniversalComposerWrap::~UniversalComposerWrap() {
}

NAN_MODULE_INIT(UniversalComposerWrap::Init) {
  v8::Local<v8::FunctionTemplate> ctor = Nan::New<v8::FunctionTemplate>(UniversalComposerWrap::New);
  constructor.Reset(ctor);
  ctor->InstanceTemplate()->SetInternalFieldCount(1);
  ctor->SetClassName(Nan::New("Composer").ToLocalChecked());
  Nan::SetPrototypeMethod(ctor, "composeSync", composeSync);
  Nan::SetPrototypeMethod(ctor, "compose", composeAsync);
  Nan::SetPrototypeMethod(ctor, "composeWithProgress", composeWithProgress);
  
  target->Set(Nan::New("Composer").ToLocalChecked(), ctor->GetFunction());
 }


// void UniversalComposerWrap::New(const FunctionCallbackInfo<Value>& args) {
NAN_METHOD(UniversalComposerWrap::New) {
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
    UniversalComposerWrap* obj = new UniversalComposerWrap(configstr);
    obj->Wrap(info.This());
    info.GetReturnValue().Set(info.This());
  } else {
    std::cout << "Must provide config" << std::endl;
  }
  // else {
//     // Invoked as plain function `Factory(...)`, turn into construct call.
//     const int argc = 1;
//     Local<Value> argv[argc] = { args[0] };
//     Local<Function> cons = Local<Function>::New(isolate, constructor);
//     Local<Object> result =
//         cons->NewInstance(context, argc, argv).ToLocalChecked();
//     args.GetReturnValue().Set(result);
//   }
}

NAN_METHOD(UniversalComposerWrap::composeSync){//(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = info.GetIsolate();

  UniversalComposerWrap* factory = ObjectWrap::Unwrap<UniversalComposerWrap>(info.Holder());
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
      Output_t output = factory->satisfy_request(request);
      Local<String> retval = String::NewFromUtf8(isolate, output->c_str());
      info.GetReturnValue().Set(retval);
    }
  } else {
    return Nan::ThrowError(Nan::New("Need a request object as first argument.").ToLocalChecked());
  }
  
}


// Async
NAN_METHOD(UniversalComposerWrap::composeAsync){
  Isolate* isolate = info.GetIsolate();
  UniversalComposerWrap* factory = ObjectWrap::Unwrap<UniversalComposerWrap>(info.Holder());
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
  
 // starting the async worker
  Nan::AsyncQueueWorker(new MyFactoryWorker(
    factory,
    request,
    new Nan::Callback(info[1].As<v8::Function>())
  ));
  
}


// Async
NAN_METHOD(UniversalComposerWrap::composeWithProgress){
  Isolate* isolate = info.GetIsolate();
  UniversalComposerWrap* factory = ObjectWrap::Unwrap<UniversalComposerWrap>(info.Holder());
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
  Nan::AsyncQueueWorker(new MyFactoryWorkerWithProgress(
    factory,
    request,
    new Nan::Callback(info[2].As<v8::Function>()),
    new Nan::Callback(info[1].As<v8::Function>())
  ));
  
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
  NODE_MODULE(NODE_GYP_MODULE_NAME, UniversalComposerWrap::Init)


}  // namespace argo


