#ifndef WRAPPEDFACTORY_H_F458F326
#define WRAPPEDFACTORY_H_F458F326
#include <nan.h>
#include "UniversalComposer.h"
namespace argo {
  

  class UniversalComposerWrap : public Nan::ObjectWrap, public UniversalComposer {
   public:
    static NAN_MODULE_INIT(Init);

    static NAN_METHOD(New); //void New(const v8::FunctionCallbackInfo<v8::Value>& args);

   private:
    explicit UniversalComposerWrap(const std::string& config);
    ~UniversalComposerWrap();

    static NAN_METHOD(composeSync);
    static NAN_METHOD(composeAsync); // Async
    static NAN_METHOD(composeWithProgress); // Async
    static Nan::Persistent<v8::FunctionTemplate> constructor;
  };

}
#endif /* end of include guard: WRAPPEDFACTORY_H_F458F326 */
