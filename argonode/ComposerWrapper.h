#ifndef WRAPPEDFACTORY_H_F458F326
#define WRAPPEDFACTORY_H_F458F326
#include <nan.h>
#include "UniversalComposer.h"
namespace argo {
  

  class ComposerWrapper : public Nan::ObjectWrap, public UniversalComposer {
   public:
    static NAN_MODULE_INIT(Init);

    static NAN_METHOD(New); //void New(const v8::FunctionCallbackInfo<v8::Value>& args);

   private:
    explicit ComposerWrapper(const std::string& config);
    ~ComposerWrapper();

    static NAN_METHOD(composeSync);
    static NAN_METHOD(composeIncremental); // Async
    static Nan::Persistent<v8::FunctionTemplate> constructor;
  public:
    Output_t satisfy_request_ref(Request_t);
    bool   m_running;
  };

}
#endif /* end of include guard: WRAPPEDFACTORY_H_F458F326 */
