#include "Factory.h"
#include "ComposerFactory.h"

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
  Factory* factory;
  Request_t request;
  Output_t output;
    
  MyFactoryWorker(Factory* f, Request_t req, Nan::Callback *done_callback )
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
    output = factory->compose(request);
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
  Factory* factory;
  Request_t request;
  Output_t output;
    
  MyFactoryWorkerWithProgress(Factory* f, Request_t req, Nan::Callback* progress_callback, Nan::Callback *done_callback )
    : Nan::AsyncProgressWorker(done_callback)
    , progress_callback(progress_callback) 
    , factory(f)
    , request(req)
    , output(new std::string)
  {}

  ~MyFactoryWorkerWithProgress() { delete progress_callback; }


  void do_progress(const Nan::AsyncProgressWorker::ExecutionProgress& progress, float f, const std::string& s) 
  {
    std::cout << "do_progress " << f << " " << s << std::endl;
    nlohmann::json report;
    report["progress"] = f;
    report["state"] = std::string(s);  // prevents segfault - the handle is a good thing to use.
    std::string out = report.dump();
    std::cout << "do_progress " << out << std::endl;
    // progress.Send(out.c_str(), out.size());
  }

  void Execute(const Nan::AsyncProgressWorker::ExecutionProgress &ep) {
    // Bind this object's do_progress() call to 
    
    Composer::ProgressCallback_t cb = std::bind(
      &MyFactoryWorkerWithProgress::do_progress,
      this,
       std::ref(ep),
      std::placeholders::_1, std::placeholders::_2);
    output = factory->compose(request, cb);
    
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

Nan::Persistent<v8::FunctionTemplate> Factory::constructor;

Factory::Factory(const std::string& config) : ComposerFactory()
{
  Config_t c(new nlohmann::json(nlohmann::json::parse(config)));
  std::cout << "Configure with " << c->dump(2) << std::endl;
  configure(c);
}

Factory::~Factory() {
}

NAN_MODULE_INIT(Factory::Init) {
  v8::Local<v8::FunctionTemplate> ctor = Nan::New<v8::FunctionTemplate>(Factory::New);
  constructor.Reset(ctor);
  ctor->InstanceTemplate()->SetInternalFieldCount(1);
  ctor->SetClassName(Nan::New("Factory").ToLocalChecked());
  Nan::SetPrototypeMethod(ctor, "composeSync", composeSync);
  Nan::SetPrototypeMethod(ctor, "compose", composeAsync);
  Nan::SetPrototypeMethod(ctor, "composeWithProgress", composeWithProgress);
  
  target->Set(Nan::New("Factory").ToLocalChecked(), ctor->GetFunction());
 }


// void Factory::New(const FunctionCallbackInfo<Value>& args) {
NAN_METHOD(Factory::New) {
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
    Factory* obj = new Factory(configstr);
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

NAN_METHOD(Factory::composeSync){//(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = info.GetIsolate();

  Factory* factory = ObjectWrap::Unwrap<Factory>(info.Holder());
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
      Output_t output = factory->compose(request);
      Local<String> retval = String::NewFromUtf8(isolate, output->c_str());
      info.GetReturnValue().Set(retval);
    }
  } else {
    return Nan::ThrowError(Nan::New("Need a request object as first argument.").ToLocalChecked());
  }
  
}


// Async
NAN_METHOD(Factory::composeAsync){
  Isolate* isolate = info.GetIsolate();
  Factory* factory = ObjectWrap::Unwrap<Factory>(info.Holder());
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
NAN_METHOD(Factory::composeWithProgress){
  Isolate* isolate = info.GetIsolate();
  Factory* factory = ObjectWrap::Unwrap<Factory>(info.Holder());
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
  NODE_MODULE(NODE_GYP_MODULE_NAME, Factory::Init)


}  // namespace argo


